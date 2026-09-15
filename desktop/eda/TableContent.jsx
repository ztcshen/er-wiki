import {
  formatFieldType,
  chineseFieldName,
} from "@drawdb/utils/fieldPresentation";
import { fieldEnumValues } from "@drawdb/utils/fieldEnumValues";
import { compactTitle, fitText } from "./presentation.mjs";
import { tr } from "../i18n/renderer";

export default function TableContent({
  node,
  meta: m,
  compact,
  scale,
  endpoint,
  onField,
}) {
  if (compact) {
    const size = Math.min(
      36,
      (node.height - 32) / 2.4,
      12 / Math.max(scale, 0.15),
    );
    const lines = compactTitle(m.businessName || m.title, node.width - 32, size);
    const start = (node.height - (lines.length - 1) * size * 1.15) / 2 - 4;
    return (
      <g data-eda-summary>
        {lines.map((line, i) => (
          <text
            key={i}
            x="16"
            y={start + i * size * 1.15}
            fill="var(--wiki-ink)"
            fontSize={size}
            fontWeight="650"
          >
            {line}
          </text>
        ))}
        <text
          x="16"
          y={node.height - 13}
          fontSize={Math.min(24, size * 0.65)}
          fill="var(--wiki-muted)"
        >
          {m.totalFields} 个字段
        </text>
      </g>
    );
  }
  return (
    <>
      <text x="12" y="26" className="eda-node-title">
        <title>{m.businessName ? `${m.businessName} · ${m.title}` : m.title}</title>
        {fitText(m.businessName || m.title, node.width - 24, 14)}
      </text>
      <text x="12" y="47" className="eda-small">
        <title>{m.title}</title>
        {fitText(m.businessName ? m.title : m.domainUnassigned ? tr(m.domainName) : m.domainName, 230)} ·{" "}
        {m.totalFields} 个字段
      </text>
      {m.fields.length === 0 ? (
        <text x="12" y="87" className="eda-small">
          点击查看表 / 关键字段 →
        </text>
      ) : (
        <>
          <rect
            x="1"
            y="55"
            width={node.width - 2}
            height="23"
            fill="var(--wiki-surface)"
          />
          <text x="12" y="71" className="eda-small">
            字段名
          </text>
          <text x="162" y="71" className="eda-small">
            类型
          </text>
          <text x="270" y="71" className="eda-small">
            显示名称
          </text>
          {m.fields.map((field, index) => (
            <g
              key={field.id}
              data-eda-field={String(field.id)}
              data-eda-endpoint={
                endpoint(m.tableId, field.id) ? "true" : "false"
              }
              role="button"
              tabIndex={0}
              aria-label={field.name}
              onClick={(event) => {
                event.stopPropagation();
                onField(m.tableId, field.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onField(m.tableId, field.id);
                }
              }}
            >
              <rect
                x="1"
                y={78 + index * 30}
                width={node.width - 2}
                height="30"
                fill={
                  endpoint(m.tableId, field.id)
                    ? "var(--eda-field-active)"
                    : index % 2
                      ? "var(--wiki-surface)"
                      : "var(--wiki-card)"
                }
              />
              <title>
                {[
                  field.name + ": " + (field.comment || "未提供注释"),
                  ...fieldEnumValues(m.title, field).values.map(
                    (value) => value.value + " — " + value.label,
                  ),
                ].join("\n")}
              </title>
              <line
                x1="0"
                x2={node.width}
                y1={78 + index * 30}
                y2={78 + index * 30}
                stroke="var(--wiki-line)"
              />
              <text x="12" y={98 + index * 30} className="eda-field-name">
                {field.primary ? "⚿ " : ""}
                {fitText(field.name, field.primary ? 130 : 142)}
              </text>
              <text x="162" y={98 + index * 30} className="eda-field-type">
                <title>{formatFieldType(field)}</title>
                {formatFieldType(field).slice(0, 18)}
              </text>
              <text x="270" y={98 + index * 30} className="eda-small">
                <title>{chineseFieldName(m.title, field.name, field)}</title>
                {fitText(chineseFieldName(m.title, field.name, field), 78)}
              </text>
            </g>
          ))}
        </>
      )}
    </>
  );
}
