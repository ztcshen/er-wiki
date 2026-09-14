import {
  formatFieldType,
  chineseFieldName,
} from "@drawdb/utils/fieldPresentation";
import { fieldEnumValues } from "@drawdb/utils/fieldEnumValues";
import FieldCodeReference from "../renderer/FieldCodeReference";
import { cardinalityOf } from "./cardinality.mjs";

export default function FieldDetails({
  field,
  table,
  tables,
  relationships,
  actions,
  readOnly,
}) {
  const name = chineseFieldName(table.name, field.name, field);
  const enums = fieldEnumValues(table.name, field).values;
  const related = relationships.filter((relation) =>
    (relation.fields?.length ? relation.fields : [relation]).some(
      (pair) =>
        (relation.startTableId === table.id &&
          pair.startFieldId === field.id) ||
        (relation.endTableId === table.id && pair.endFieldId === field.id),
    ),
  );
  return (
    <section className="eda-field-details" data-eda-field-details>
      <button
        className="eda-context-back"
        onClick={() => (actions.selectTable || actions.inspectTable)(table.id)}
        title="返回表详情"
      >
        <i className="bi bi-arrow-left" aria-hidden="true" /> {table.name}
      </button>
      <h3>{field.name}</h3>
      <code>{formatFieldType(field)}</code>
      <p>{name}</p>
      <div className="eda-table-stats">
        {field.primary && <span>PK</span>}
        <span>{field.notNull ? "不可为空" : "可为空"}</span>
      </div>
      <p>
        默认值：
        {field.default == null || field.default === ""
          ? "未设置"
          : String(field.default)}
      </p>
      {!readOnly && (
        <button onClick={() => actions.editTable(table.id)}>编辑表</button>
      )}
      {!!enums.length && (
        <section aria-label="枚举值">
          <div className="eda-section-title">
            <strong>枚举值</strong>
            <span>{enums.length}</span>
          </div>
          <div className="eda-enum-values">
            {enums.map((value, index) => (
              <p key={index}>
                <code>{value.value}</code> {value.label}
              </p>
            ))}
          </div>
        </section>
      )}
      {!!related.length && (
        <section className="eda-field-relations" aria-label="字段关联">
          <div className="eda-section-title">
            <strong>关联关系</strong>
            <span>{related.length}</span>
          </div>
          {related.map((relation) => {
            const source = tables.find(
              (value) => value.id === relation.startTableId,
            );
            const target = tables.find(
              (value) => value.id === relation.endTableId,
            );
            const card = cardinalityOf(relation);
            return (
              <button
                key={relation.id}
                data-field-relation={String(relation.id)}
                onClick={() => actions.selectRelated(relation.id)}
              >
                <span>
                  {source?.name || "—"} → {target?.name || "—"}
                </span>
                <b>
                  {card.start} : {card.end}
                </b>
              </button>
            );
          })}
        </section>
      )}
      {field.comment && field.comment !== name && (
        <details className="eda-evidence">
          <summary>注释</summary>
          <p>{field.comment}</p>
        </details>
      )}
      <FieldCodeReference tableName={table.name} field={field} />
    </section>
  );
}
