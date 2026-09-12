import { useEffect, useState } from "react";
import CanvasEditorDialog from "@drawdb/components/EditorCanvas/CanvasEditorDialog";
import { validateProcessModel, bindingIssues } from "./definition.mjs";
import { tr } from "../i18n/renderer";

export default function ProcessConfig({
  open,
  onClose,
  definition,
  onApply,
  tables,
  readOnly,
}) {
  const [draft, setDraft] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setDraft(
        JSON.stringify(definition || { version: 1, scenarios: [] }, null, 2),
      );
      setError("");
    }
  }, [open]);
  const apply = () => {
    try {
      const next = validateProcessModel(JSON.parse(draft));
      const issues = bindingIssues(next, tables);
      if (issues.length)
        throw new Error(issues.map((issue) => issue.message).join("\n"));
      onApply(next);
      onClose();
    } catch (failure) {
      setError(failure.message);
    }
  };
  return (
    <CanvasEditorDialog
      visible={open}
      onClose={onClose}
      title="流程配置"
      footerNote="流程配置随模型保存；本地对比版暂不接入撤销栈。"
    >
      <div className="desktop-form process-config">
        <p>
          显式配置业务动作、条件、表字段映射。不会从外键自动生成流程，也不会执行这里的条件或状态变更。
        </p>
        <textarea
          aria-label="流程定义 JSON"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck={false}
          readOnly={readOnly}
        />
        {error && <p role="alert">{tr(error)}</p>}
        <button disabled={readOnly} onClick={apply}>
          校验并应用
        </button>
      </div>
    </CanvasEditorDialog>
  );
}
