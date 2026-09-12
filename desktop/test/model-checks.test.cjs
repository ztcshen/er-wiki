const { test } = require("node:test"),
  assert = require("node:assert/strict");
const load = () => import("../review/model-checks.mjs");
const f = (id, name, type = "BIGINT") => ({
  id,
  name,
  type,
  size: "",
  primary: false,
  notNull: true,
  default: "",
});
const fixture = () => ({
  tables: [
    {
      id: 0,
      name: "orders",
      fields: [f(0, "id"), f(1, "status", "VARCHAR")],
      indices: [],
    },
    {
      id: 1,
      name: "items",
      fields: [f(0, "id"), f(1, "order_id")],
      indices: [],
    },
  ],
  relationships: [
    {
      id: 0,
      name: "items_orders",
      startTableId: 1,
      endTableId: 0,
      startFieldId: 1,
      endFieldId: 0,
      fields: [{ startFieldId: 1, endFieldId: 0 }],
      cardinality: "many_to_one",
    },
  ],
});
test("checks are pure, support numeric zero identifiers and accept logical joins without unique keys", async () => {
  const { checkModel } = await load(),
    model = fixture(),
    before = JSON.stringify(model);
  assert.deepEqual(checkModel(model), []);
  assert.equal(JSON.stringify(model), before);
});
test("duplicate and empty names are reported and disappear after editing", async () => {
  const { checkModel } = await load(),
    model = fixture();
  model.tables[1].name = "orders";
  model.tables[0].fields[1].name = "id";
  assert(checkModel(model).some((i) => i.code === "table_name"));
  assert(checkModel(model).some((i) => i.code === "field_name"));
  model.tables[1].name = "items";
  model.tables[0].fields[1].name = "status";
  assert.deepEqual(checkModel(model), []);
  model.tables[0].fields[0].name = "";
  assert(checkModel(model).some((i) => i.code === "field_blank"));
});
test("broken relationships are retained and identified, not silently repaired", async () => {
  const { checkModel } = await load(),
    model = fixture();
  model.relationships[0].endTableId = 99;
  assert.equal(checkModel(model)[0].code, "relation_table");
  assert.equal(model.relationships[0].endTableId, 99);
  model.relationships[0].endTableId = 0;
  model.relationships[0].fields[0].endFieldId = 99;
  assert(checkModel(model).some((i) => i.code === "relation_field"));
});
test("type/size/unsigned differences and SET NULL conflicts are warnings only", async () => {
  const { checkModel } = await load(),
    model = fixture();
  model.tables[1].fields[1].unsigned = true;
  model.relationships[0].deleteConstraint = "Set null";
  const found = checkModel(model);
  assert(
    found.some((i) => i.code === "relation_type" && i.severity === "warning"),
  );
  assert(found.some((i) => i.code === "relation_set_null"));
});
test("duplicate relationships and field pairs are distinct diagnostics", async () => {
  const { checkModel } = await load(),
    model = fixture();
  model.relationships.push({ ...model.relationships[0], id: 1 });
  assert(checkModel(model).some((i) => i.code === "relation_duplicate"));
  model.relationships.pop();
  model.relationships[0].fields.push({ ...model.relationships[0].fields[0] });
  assert(checkModel(model).some((i) => i.code === "relation_pair_duplicate"));
});
test("indexes can reference IDs or names but cannot reference missing fields", async () => {
  const { checkModel } = await load(),
    model = fixture();
  model.tables[0].indices = [{ id: 0, name: "valid", fields: [0, "status"] }];
  assert.deepEqual(checkModel(model), []);
  model.tables[0].indices[0].fields.push("gone");
  assert(checkModel(model).some((i) => i.code === "index_reference"));
});
test("quoted enum defaults match values; SQL expressions are not guessed", async () => {
  const { checkModel, defaultLiteral } = await load(),
    model = fixture(),
    field = model.tables[0].fields[1];
  field.reviewEnumValues = [{ value: "OPEN", label: "开放" }];
  field.default = "'OPEN'";
  assert.deepEqual(checkModel(model), []);
  field.default = "CLOSED";
  assert(checkModel(model).some((i) => i.code === "enum_default"));
  field.default = "CURRENT_TIMESTAMP";
  assert(!checkModel(model).some((i) => i.code === "enum_default"));
  assert.equal(defaultLiteral("'it''s'"), "it's");
  assert.equal(defaultLiteral("uuid()"), null);
});
test("enum duplicates, empty SQL enum and explicit size metadata are checked", async () => {
  const { checkModel } = await load(),
    model = fixture(),
    field = model.tables[0].fields[1];
  field.reviewEnumValues = [{ value: "A" }, { value: "A" }];
  assert(checkModel(model).some((i) => i.code === "enum_duplicate"));
  field.type = "ENUM";
  field.values = [];
  assert(checkModel(model).some((i) => i.code === "enum_empty"));
  field.type = "VARCHAR";
  field.size = "x";
  assert(
    checkModel(model, { typeInfo: () => ({ isSized: true }) }).some(
      (i) => i.code === "field_size",
    ),
  );
});
test("composite endpoint drafts preserve legacy primary pair and swapping reverses cardinality without renaming", async () => {
  const { validateRelationshipDraft, endpointPatch, swappedRelationship } =
      await import("../review/relationship-draft.mjs"),
    model = fixture();
  const draft = {
    startTableId: 1,
    endTableId: 0,
    fields: [
      { startFieldId: 0, endFieldId: 0 },
      { startFieldId: 1, endFieldId: 1 },
    ],
  };
  assert.deepEqual(validateRelationshipDraft(draft, model.tables).errors, []);
  const relation = {
    ...model.relationships[0],
    ...endpointPatch(draft),
    name: "custom",
  };
  const patch = swappedRelationship(relation);
  assert.equal(patch.cardinality, "one_to_many");
  assert.equal(patch.startTableId, 0);
  assert.equal(patch.name, undefined);
  const twice = {
    ...relation,
    ...patch,
    ...swappedRelationship({ ...relation, ...patch }),
  };
  assert.deepEqual(twice, relation);
  assert(
    validateRelationshipDraft(
      {
        startTableId: 0,
        endTableId: 0,
        fields: [{ startFieldId: 0, endFieldId: 0 }],
      },
      model.tables,
    ).errors.length,
  );
});
