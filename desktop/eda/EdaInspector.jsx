import TableDetails from "./TableDetails";
import FieldCodeReference from "../renderer/FieldCodeReference";
import {
  formatFieldType,
  chineseFieldName,
} from "@drawdb/utils/fieldPresentation";
import { fieldEnumValues } from "@drawdb/utils/fieldEnumValues";
import { cardinalityOf } from "./cardinality.mjs";
import { tr } from "../i18n/renderer";

export default function EdaInspector({
  selection,
  tables,
  relationships,
  actions,
  readOnly = false,
}) {
  const { net, table, field, alternatives, selectedRelation } = selection;
  return (
    <aside className="eda-inspector" aria-label="对象详情">
      <div className="eda-inspector-heading">
        <strong>{net ? "关系详情" : field ? "字段详情" : "表详情"}</strong>
        <button
          className="eda-icon-button"
          aria-label="关闭详情"
          title="关闭详情"
          onClick={actions.clear}
        >
          ×
        </button>
      </div>
      {field && (
        <section className="eda-field-details" data-eda-field-details>
          <h3>{field.name}</h3>
          <code>{formatFieldType(field)}</code>
          <p>{chineseFieldName(table.name, field.name, field)}</p>
          <p>
            {field.comment === chineseFieldName(table.name, field.name, field)
              ? ""
              : field.comment || "未提供注释"}
          </p>
          <FieldCodeReference tableName={table.name} field={field} />
          <p>
            默认值：{field.default === "" ? "未设置" : String(field.default)}
          </p>
          <div className="eda-enum-values">
            {fieldEnumValues(table.name, field).values.map((value) => (
              <p key={value.value}>
                <code>{value.value}</code> {value.label}
              </p>
            ))}
          </div>
        </section>
      )}
      {alternatives.length > 1 && (
        <div className="eda-network-options">
          此选择涉及 {alternatives.length} 个网络：
          {alternatives.map((item) => (
            <button key={item.id} onClick={() => actions.selectNet(item.id)}>
              {item.code}
            </button>
          ))}
        </div>
      )}
      {net ? (
        <>
          <h3>
            {net.code}
            <span className="eda-detail-count">
              {net.members.length} 条关系
            </span>
          </h3>
          <p className="eda-code">{net.name}</p>
          <p className="eda-cardinality-note">
            1 = 一条，N =
            多条；仅表示关系基数，不代表实际数据量，也未推断最少条数。
          </p>
          <button onClick={() => actions.trace(net)}>展开完整关系</button>
          {selectedRelation != null && (
            <button onClick={actions.focusRelation}>定位关系</button>
          )}
          <button onClick={actions.cancelTrace}>取消追踪</button>
          <div className="eda-member-list">
            {net.members.map((relation) => {
              const source = tables.find((t) => t.id === relation.startTableId),
                target = tables.find((t) => t.id === relation.endTableId);
              const pairs = relation.fields?.length
                ? relation.fields
                : [relation];
              const card = cardinalityOf(relation);
              return (
                <article
                  key={relation.id}
                  data-net-member={String(relation.id)}
                  data-selected={selectedRelation === relation.id}
                >
                  <div className="eda-member-heading">
                    <button
                      className="eda-text-link"
                      title="查看源表字段"
                      onClick={() => actions.inspectTable(source?.id)}
                    >
                      {source?.name}
                    </button>
                    {!readOnly && (
                      <button
                        className="eda-icon-button"
                        aria-label={`编辑关系 ${relation.name}`}
                        title="编辑关系"
                        onClick={() => actions.editRelation(relation.id)}
                      >
                        <i className="bi bi-pencil" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <button
                    className="eda-cardinality-pair"
                    aria-label={`高亮关系 ${relation.name}`}
                    aria-pressed={selectedRelation === relation.id}
                    onClick={() => actions.selectRelation(relation.id)}
                  >
                    <strong>
                      {card.start} : {card.end}
                    </strong>
                    <span>{tr(card.name)}</span>
                  </button>
                  <p className="eda-cardinality-tables">
                    {source?.name} ({card.start}) — ({card.end}) {target?.name}
                  </p>
                  <p>
                    {pairs
                      .map(
                        (pair) =>
                          `${source?.fields.find((f) => f.id === pair.startFieldId)?.name} → ${target?.name}.${target?.fields.find((f) => f.id === pair.endFieldId)?.name}`,
                      )
                      .join("；")}
                  </p>
                  <details className="eda-evidence">
                    <summary>
                      {relation.reviewEvidence?.kind === "inferred"
                        ? "待核关联 · 查看依据"
                        : "关联依据"}
                    </summary>
                    <small>
                      {relation.reviewEvidence?.kind === "physical"
                        ? "已记录物理约束"
                        : relation.reviewEvidence?.description ||
                          "逻辑关系；物理约束与基数以原始定义为准"}
                    </small>
                  </details>
                </article>
              );
            })}
          </div>
        </>
      ) : table ? (
        <TableDetails
          table={table}
          tables={tables}
          relationships={relationships}
          field={field}
          actions={actions}
          readOnly={readOnly}
        />
      ) : null}
    </aside>
  );
}
