import { Popover } from "@douyinfe/semi-ui";
import EdaDisplaySettings from "./EdaDisplaySettings";
import { tr } from "../i18n/renderer";

export default function EdaToolbar({
  model,
  leading,
  domains,
  reading,
  settings,
  setSettings,
  currentDomain,
  visibleTableCount,
  busy,
  navigate,
  arrange,
  issues = [],
  onCheck,
  checksOpen,
}) {
  const { tables, relationships } = model;
  const { level, tableId } = reading.location;
  const scopeTable = tables.find((table) => table.id === tableId);
  const showDirectory = settings.edaDirectory !== false;
  const scopeName =
    level === "system"
      ? tr("领域概览")
      : scopeTable
        ? scopeTable.name +
          " · " +
          tr(level === "column" ? "全部字段" : "关联表")
        : currentDomain?.name || "";
  return (
    <div className="eda-toolbar">
      <div className="eda-controls">
        {leading}
        <button
          className="eda-icon-button"
          aria-label="返回上次阅读位置"
          title="返回上次阅读位置"
          disabled={!reading.canBack}
          onClick={reading.back}
        >
          <i className="bi bi-arrow-left" aria-hidden="true" />
        </button>
        <button
          className="eda-icon-button"
          aria-label={showDirectory ? "收起目录" : "展开目录"}
          aria-pressed={showDirectory}
          title="显示或收起目录"
          onClick={() =>
            setSettings((s) => ({
              ...s,
              edaDirectory: s.edaDirectory === false,
            }))
          }
        >
          <i className="bi bi-layout-sidebar" aria-hidden="true" />
        </button>
        <button
          className="eda-overview-button"
          aria-label="返回全部表总图"
          aria-pressed={level === "overview"}
          onClick={() => navigate("overview")}
        >
          总图
        </button>
        {scopeName && (
          <span className="eda-scope-name" title={scopeName}>
            {scopeName}
          </span>
        )}
        <span
          className="eda-model-count"
          data-eda-scope
          title={`完整模型：${tables.length} 张表，${relationships.length} 条关系；前一个数字为当前视图可见表数`}
        >
          {level === "system"
            ? `${domains.length} 个领域`
            : `${visibleTableCount ?? "…"} / ${tables.length} 表`}
          <span> · {relationships.length} 条关系</span>
        </span>
        <div className="eda-view-actions">
          <button
            className="eda-check-button"
            data-errors={issues.some((issue) => issue.severity === "error")}
            onClick={onCheck}
            aria-pressed={checksOpen}
            aria-label="结构检查"
          >
            <i className="bi bi-check2-square" aria-hidden="true" />
            检查 <span>{issues.length}</span>
          </button>
          <button
            onClick={arrange}
            disabled={busy || !tables.length}
            title="重新整理正交连线，不修改模型坐标"
          >
            <i className="bi bi-diagram-3" aria-hidden="true" />
            整理
          </button>
          <Popover
            trigger="click"
            position="bottomRight"
            content={
              <EdaDisplaySettings
                model={model}
                reading={reading}
                settings={settings}
                setSettings={setSettings}
                navigate={navigate}
              />
            }
          >
            <button aria-label="图形显示设置">
              <i className="bi bi-sliders" aria-hidden="true" />
              显示
            </button>
          </Popover>
        </div>
      </div>
    </div>
  );
}
