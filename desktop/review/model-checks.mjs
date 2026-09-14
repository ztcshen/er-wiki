import { parseFieldSize } from "../renderer/field-size.mjs";

export const pairsOf = (relation) =>
  relation.fields?.length
    ? relation.fields
    : [
        {
          startFieldId: relation.startFieldId,
          endFieldId: relation.endFieldId,
        },
      ];
export const fieldByKey = (table, key) =>
  table?.fields?.find((field) => field.id === key) ||
  table?.fields?.find((field) => field.name === key);
export function defaultLiteral(value) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (/^'(?:[^']|'')*'$/.test(text))
    return text.slice(1, -1).replaceAll("''", "'");
  if (/^"(?:[^"]|"")*"$/.test(text))
    return text.slice(1, -1).replaceAll('""', '"');
  if (/^(NULL|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|NOW)$/i.test(text))
    return null;
  return /^[-\w.]+$/.test(text) ? text : null;
}
export const enumValues = (field) =>
  ["ENUM", "SET"].includes(String(field.type).toUpperCase())
    ? (field.values || []).map(String)
    : (field.reviewEnumValues || []).map((value) => String(value.value));
export function fieldDefinition(field) {
  const type = String(field.type || "")
    .trim()
    .toUpperCase();
  const alias = {
    INTEGER: "INT",
    "CHARACTER VARYING": "VARCHAR",
    DEC: "DECIMAL",
  };
  return JSON.stringify([
    alias[type] || type,
    String(field.size ?? "")
      .replaceAll(/\s/g, "")
      .toUpperCase(),
    !!field.unsigned,
  ]);
}

// Derived diagnostics only: never annotate, save, repair or version the model.
// Definition differences are advisory, not proof that a logical join is invalid.
export function checkModel(model, { typeInfo = () => ({}) } = {}) {
  const issues = [],
    tables = model.tables || [],
    relations = model.relationships || model.references || [];
  const tableIndex = new Map(tables.map((table) => [table.id, table]));
  const push = (code, severity, target, params = {}) =>
    issues.push({
      id: JSON.stringify([code, target, params, issues.length]),
      code,
      severity,
      target,
      params,
    });
  const duplicates = (items, key, report) => {
    const seen = new Map();
    for (const item of items) {
      const value = key(item);
      if (value == null) continue;
      if (seen.has(value)) report(item, seen.get(value));
      else seen.set(value, item);
    }
  };
  duplicates(
    tables,
    (t) => t.id,
    (t) => push("table_id", "error", { tableId: t.id }, { table: t.name }),
  );
  duplicates(
    tables,
    (t) => JSON.stringify([t.schema || "", String(t.name || "").trim()]),
    (t) => push("table_name", "error", { tableId: t.id }, { table: t.name }),
  );
  duplicates(
    relations,
    (r) => r.id,
    (r) =>
      push(
        "relation_id",
        "error",
        { relationshipId: r.id },
        { relation: r.name },
      ),
  );
  for (const table of tables) {
    const target = { tableId: table.id },
      fields = table.fields || [];
    if (!String(table.name || "").trim()) push("table_blank", "error", target);
    if (!fields.length)
      push("table_empty", "error", target, { table: table.name });
    duplicates(
      fields,
      (f) => f.id,
      (f) =>
        push(
          "field_id",
          "error",
          { ...target, fieldId: f.id },
          { table: table.name, field: f.name },
        ),
    );
    duplicates(
      fields,
      (f) => String(f.name || "").trim(),
      (f) =>
        push(
          "field_name",
          "error",
          { ...target, fieldId: f.id },
          { table: table.name, field: f.name },
        ),
    );
    for (const field of fields) {
      const location = { ...target, fieldId: field.id },
        params = { table: table.name, field: field.name };
      if (!String(field.name || "").trim())
        push("field_blank", "error", location, { table: table.name });
      if (!String(field.type || "").trim())
        push("field_type", "error", location, params);
      if (field.primary && field.notNull === false)
        push("primary_nullable", "warning", location, params);
      if (
        field.notNull &&
        String(field.default).trim().toUpperCase() === "NULL"
      )
        push("null_default", "warning", location, params);
      const info = typeInfo(field.type) || {};
      if (
        (info.isSized || info.hasPrecision) &&
        !parseFieldSize(field.size, info.hasPrecision).valid
      )
        push("field_size", "error", location, params);
      const values = enumValues(field);
      if (new Set(values).size !== values.length)
        push("enum_duplicate", "error", location, params);
      if (
        ["ENUM", "SET"].includes(String(field.type).toUpperCase()) &&
        !values.length
      )
        push("enum_empty", "error", location, params);
      const literal = defaultLiteral(field.default);
      const defaults =
        String(field.type).toUpperCase() === "SET" && literal != null
          ? literal.split(",")
          : [literal];
      if (
        values.length &&
        literal != null &&
        defaults.some((value) => !values.includes(value))
      )
        push("enum_default", "warning", location, {
          ...params,
          value: literal,
        });
    }
    for (const [kind, indexes] of [
      ["index", table.indices || []],
      ["unique", table.uniqueConstraints || []],
    ]) {
      for (const index of indexes) {
        const location = { ...target, indexId: index.id },
          params = { table: table.name, index: index.name || String(index.id) };
        if (!index.fields?.length)
          push("index_empty", "warning", location, params);
        else {
          if (index.fields.some((key) => !fieldByKey(table, key)))
            push("index_reference", "error", location, params);
          const ids = index.fields.map(
            (key) => fieldByKey(table, key)?.id ?? key,
          );
          if (new Set(ids).size !== ids.length)
            push("index_duplicate", "warning", location, params);
        }
      }
      duplicates(
        indexes,
        (index) => index.name || null,
        (index) =>
          push(
            "index_name",
            "warning",
            { ...target, indexId: index.id },
            { table: table.name, index: index.name, kind },
          ),
      );
    }
  }
  const definitions = new Set();
  for (const relation of relations) {
    const location = { relationshipId: relation.id },
      params = { relation: relation.name || String(relation.id) };
    const source = tableIndex.get(relation.startTableId),
      target = tableIndex.get(relation.endTableId),
      pairs = pairsOf(relation);
    if (!source || !target) {
      push("relation_table", "error", location, params);
      continue;
    }
    const signature = JSON.stringify([
      source.id,
      target.id,
      pairs.map((p) => JSON.stringify([p.startFieldId, p.endFieldId])).sort(),
    ]);
    if (definitions.has(signature))
      push("relation_duplicate", "warning", location, params);
    definitions.add(signature);
    const seen = new Set();
    for (const [index, pair] of pairs.entries()) {
      const start = source.fields.find((f) => f.id === pair.startFieldId),
        end = target.fields.find((f) => f.id === pair.endFieldId);
      const pairLocation = { ...location, pairIndex: index },
        pairParams = { ...params, source: source.name, target: target.name };
      if (!start || !end) {
        push("relation_field", "error", pairLocation, pairParams);
        continue;
      }
      if (source.id === target.id && start.id === end.id)
        push("relation_self", "error", pairLocation, {
          ...pairParams,
          field: start.name,
        });
      const key = JSON.stringify([start.id, end.id]);
      if (seen.has(key))
        push("relation_pair_duplicate", "error", pairLocation, pairParams);
      seen.add(key);
      if (fieldDefinition(start) !== fieldDefinition(end))
        push("relation_type", "warning", pairLocation, {
          ...pairParams,
          startField: start.name,
          endField: end.name,
        });
      if (
        start.notNull &&
        [relation.deleteConstraint, relation.updateConstraint].some((value) =>
          /^set null$/i.test(value || ""),
        )
      )
        push("relation_set_null", "warning", pairLocation, {
          ...pairParams,
          field: start.name,
        });
    }
    if (
      pairs[0] &&
      (pairs[0].startFieldId !== relation.startFieldId ||
        pairs[0].endFieldId !== relation.endFieldId)
    )
      push("relation_legacy_pair", "warning", location, params);
  }
  return issues;
}
