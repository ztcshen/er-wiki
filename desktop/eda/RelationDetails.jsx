import { cardinalityOf } from "./cardinality.mjs";
import { tr } from "../i18n/renderer";
import { conditionText } from "./relation-condition.mjs";

export default function RelationDetails({
  net,
  selectedRelation,
  tables,
  actions,
  readOnly,
}) {
  const members =
    selectedRelation == null
      ? net.members
      : net.members.filter((relation) => relation.id === selectedRelation);
  return (
    <>
      {selectedRelation != null && net.members.length > 1 && (
        <button
          className="eda-context-back"
          onClick={() => actions.selectRelation(null)}
        >
          查看同组关系
        </button>
      )}
      <h3>
        {selectedRelation != null ? members[0]?.name : net.code}
        <span className="eda-detail-count">{members.length} 条关系</span>
      </h3>
      <p className="eda-code">{net.name}</p>
      <details className="eda-evidence">
        <summary>基数说明</summary>
        <p className="eda-cardinality-note">
          1 = 一条，N =
          多条；仅表示关系基数，不代表实际数据量，也未推断最少条数。
        </p>
      </details>
      <button onClick={() => actions.trace(net)}>展开完整关系</button>
      {selectedRelation != null && (
        <button onClick={actions.focusRelation}>定位关系</button>
      )}
      <button onClick={actions.cancelTrace}>取消追踪</button>
      <div className="eda-member-list">
        {members.map((relation) => {
          const source = tables.find((t) => t.id === relation.startTableId),
            target = tables.find((t) => t.id === relation.endTableId);
          const pairs = relation.fields?.length ? relation.fields : [relation];
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
              {conditionText(relation) && <p className="eda-code">条件关联：{conditionText(relation)}</p>}
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
  );
}
