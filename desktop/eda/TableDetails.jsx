import { useEffect, useState } from "react";
import {
  formatFieldType,
  chineseFieldName,
} from "@drawdb/utils/fieldPresentation";
import { fieldEnumValues } from "@drawdb/utils/fieldEnumValues";
import { tableRelationships } from "./presentation.mjs";
import { cardinalityOf } from "./cardinality.mjs";
import TableReviewDetails from './TableReviewDetails';
import { tableBusinessName } from '../review/table-review.mjs';

export default function TableDetails({
  table,
  tables,
  relationships,
  actions,
  readOnly = false,
}) {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("fields");
  useEffect(() => {
    setQuery("");
    setSection("fields");
  }, [table.id]);
  const relations = tableRelationships(table.id, relationships);
  const fields = table.fields.filter((value) =>
    [value.name, value.comment, chineseFieldName(table.name, value.name, value)]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase().trim()),
  );
  return (
    <div className="eda-table-details">
      <h3>{tableBusinessName(table) || table.name}</h3>
      {tableBusinessName(table) && <code>{table.name}</code>}
      <div className="eda-table-stats">
        <span>{table.fields.length} 字段</span>
        <span>{relations.length} 条关系</span>
        <span>{table.indices?.length || 0} 索引</span>
      </div>
      <div className="eda-detail-actions">
        {!readOnly && (
          <button
            className="eda-primary-button"
            onClick={() => actions.editTable(table.id)}
          >
            编辑表
          </button>
        )}
        <button onClick={() => actions.inspectTable(table.id)}>全部字段</button>
        <button
          disabled={!actions.canFocus}
          onClick={actions.focus}
          title="只调整视角，不改变查看范围"
          aria-label="定位到画布"
        >
          <i className="bi bi-crosshair" aria-hidden="true" />
        </button>
      </div>
      <div
        className="eda-detail-tabs"
        role="tablist"
        aria-label="表详情内容"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const next =
            event.key === "Home"
              ? "fields"
              : event.key === "End"
                ? "relations"
                : section === "fields"
                  ? "relations"
                  : "fields";
          setSection(next);
          event.currentTarget
            .querySelectorAll('[role="tab"]')
            [next === "fields" ? 0 : 1].focus();
        }}
      >
        <button
          role="tab"
          id="eda-fields-tab"
          aria-controls="eda-fields-panel"
          aria-selected={section === "fields"}
          tabIndex={section === "fields" ? 0 : -1}
          onClick={() => setSection("fields")}
        >
          字段 <span>{table.fields.length}</span>
        </button>
        <button
          role="tab"
          id="eda-relations-tab"
          aria-controls="eda-relations-panel"
          aria-selected={section === "relations"}
          tabIndex={section === "relations" ? 0 : -1}
          onClick={() => setSection("relations")}
        >
          关联关系 <span>{relations.length}</span>
        </button>
      </div>
      {section === "fields" ? (
        <section
          className="eda-field-browser"
          role="tabpanel"
          id="eda-fields-panel"
          aria-labelledby="eda-fields-tab"
          aria-label="表字段列表"
        >
          <div className="eda-section-title">
            <strong>字段</strong>
            <span>
              {fields.length} / {table.fields.length}
            </span>
          </div>
          {table.fields.length > 6 && (
            <input
              type="search"
              aria-label="筛选表字段"
              placeholder="字段名或显示名称"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          )}
          <div className="eda-field-browser-list">
            {fields.map((value) => (
              <button
                key={value.id}
                className="eda-field-item"
                data-field-item={String(value.id)}
                onClick={() => actions.inspectField(table.id, value.id)}
              >
                <span className="eda-field-item-name">
                  {value.primary && <b>PK</b>}
                  {value.name}
                </span>
                <code>{formatFieldType(value)}</code>
                <small>{chineseFieldName(table.name, value.name, value)}</small>
                {!!fieldEnumValues(table.name, value).values.length && (
                  <span className="eda-enum-indicator">枚举</span>
                )}
              </button>
            ))}
            {!fields.length && <p className="process-muted">没有匹配结果</p>}
          </div>
        </section>
      ) : (
        <section
          className="eda-related-tables"
          role="tabpanel"
          id="eda-relations-panel"
          aria-labelledby="eda-relations-tab"
        >
          <div className="eda-section-title">
            <strong>关联关系</strong>
            <span>{relations.length}</span>
          </div>
          {relations.map((relation) => {
            const start = relation.startTableId === table.id,
              other = tables.find(
                (value) =>
                  value.id ===
                  (start ? relation.endTableId : relation.startTableId),
              );
            const card = cardinalityOf(relation);
            return (
              <button
                key={relation.id}
                onClick={() => actions.selectRelated(relation.id)}
                data-related-relation={String(relation.id)}
              >
                <span>{other?.name || "—"}</span>
                <b>
                  {start ? card.start : card.end} :{" "}
                  {start ? card.end : card.start}
                </b>
              </button>
            );
          })}
          {!relations.length && <p>尚未配置关联关系</p>}
        </section>
      )}
      <TableReviewDetails table={table} actions={actions} />
      <details className="eda-evidence">
        <summary>表说明与来源</summary>
        <p>{table.comment || "未提供表注释"}</p>
      </details>
    </div>
  );
}
