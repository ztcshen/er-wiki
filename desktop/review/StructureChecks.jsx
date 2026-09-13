import { useState } from "react";
import { issueMessages } from "./issue-messages.mjs";
import { tr } from "../i18n/renderer";
import "./review.css";

export default function StructureChecks({
  onClose,
  issues,
  onLocate,
  onEdit,
  readOnly,
}) {
  const [severity, setSeverity] = useState("all");
  const visible = issues.filter(
    (issue) => severity === "all" || issue.severity === severity,
  );
  return (
    <aside className="eda-inspector eda-checks-panel" aria-label="结构检查结果">
      <div className="eda-inspector-heading">
        <strong>结构检查</strong>
        <button
          className="eda-icon-button"
          aria-label="关闭结构检查"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="structure-checks">
        <p>点击定位，在图中查看问题；修改后列表自动更新。</p>
        <div className="checks-filters" role="group" aria-label="检查级别">
          {[
            ["all", "全部"],
            ["error", "错误"],
            ["warning", "提醒"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={severity === key}
              onClick={() => setSeverity(key)}
            >
              {tr(label)}{" "}
              <span>
                {key === "all"
                  ? issues.length
                  : issues.filter((i) => i.severity === key).length}
              </span>
            </button>
          ))}
        </div>
        <div className="checks-results" aria-live="polite">
          {!visible.length && (
            <div className="checks-empty">
              当前范围未发现上述结构问题；业务规则仍需人工判断。
            </div>
          )}
          {visible.map((issue) => (
            <article
              key={issue.id}
              data-check-code={issue.code}
              data-check-level={issue.severity}
            >
              <div>
                <strong>{tr(issueMessages[issue.code])}</strong>
                <p>
                  {[issue.params.table, issue.params.field]
                    .filter(Boolean)
                    .join(".") ||
                    issue.params.relation ||
                    "—"}
                  {issue.params.index ? " · " + issue.params.index : ""}
                </p>
                {issue.params.startField && (
                  <small>
                    {issue.params.source}.{issue.params.startField} ↔{" "}
                    {issue.params.target}.{issue.params.endField}
                  </small>
                )}
              </div>
              <div className="checks-actions">
                <button onClick={() => onLocate(issue)}>定位</button>
                <button
                  disabled={
                    readOnly ||
                    ["table_id", "field_id", "relation_id"].includes(issue.code)
                  }
                  onClick={() => onEdit(issue)}
                >
                  编辑
                </button>
              </div>
            </article>
          ))}
        </div>
        <details className="eda-evidence">
          <summary>检查说明</summary>
          <p>
            错误表示结构缺失或引用无效；提醒需要结合设计意图判断，不等同于数据库约束错误。
          </p>
          <p>仅反映当前模型，不保存评审记录，不执行数据库检查或自动修复。</p>
        </details>
      </div>
    </aside>
  );
}
