import { Popover } from "@douyinfe/semi-ui";
import ReadingBookmarks from "./ReadingBookmarks";

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
}) {
  const { tables, relationships } = model;
  const { level, selectedTable, tableId, domainId, labels, bundle, direction } =
    reading.location;
  const setSelectedTable = reading.setPart("selectedTable");
  const showDirectory = settings.edaDirectory !== false;
  const LEVELS = [
    ["overview", "全部表"],
    ["system", "领域概览"],
    ["domain", "领域内表"],
    ["table", "关联表"],
    ["column", "全部字段"],
  ];
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
        {level !== "overview" && (
          <button
            className="eda-back-button"
            aria-label="返回全部表总图"
            onClick={() => navigate("overview")}
          >
            <i className="bi bi-arrow-left" aria-hidden="true" />
            总图
          </button>
        )}
        <select
          aria-label="原理图层级"
          title="图形层级"
          value={level}
          onChange={(e) => {
            const next = e.target.value,
              target = ["table", "column"].includes(next)
                ? selectedTable ?? tableId ?? tables[0]?.id
                : null;
            navigate(
              next,
              ["overview", "system"].includes(next) ? "" : domainId,
              target,
            );
            if (target != null) setSelectedTable(target);
          }}
        >
          {LEVELS.map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
        {currentDomain && (
          <span className="eda-scope-name" title={currentDomain.name}>
            {currentDomain.name}
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
            aria-label="结构检查"
          >
            <i className="bi bi-check2-square" aria-hidden="true" />
            检查 <span>{issues.length}</span>
          </button>
          <ReadingBookmarks session={reading} />
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
              <div className="eda-display-panel">
                <strong>图形显示</strong>
                <label className="eda-display-check">
                  <input
                    type="checkbox"
                    checked={settings.edaCardinality !== false}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSettings((s) => ({ ...s, edaCardinality: checked }));
                    }}
                  />
                  显示关系基数（1 / N）
                </label>
                <label className="eda-display-check">
                  <input
                    type="checkbox"
                    checked={settings.edaSemanticZoom !== false}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSettings((s) => ({ ...s, edaSemanticZoom: checked }));
                    }}
                  />
                  缩小时突出表名
                </label>
                <label>
                  布局方向
                  <select
                    aria-label="布局方向"
                    value={direction}
                    onChange={(e) =>
                      reading.setPart("direction")(e.target.value)
                    }
                  >
                    <option value="AUTO">自动（优先减少交叉）</option>
                    <option value="RIGHT">横向</option>
                    <option value="DOWN">纵向</option>
                  </select>
                </label>
                <label>
                  关系显示
                  <select
                    aria-label="Net Label 模式"
                    value={labels}
                    onChange={(e) => reading.setPart("labels")(e.target.value)}
                  >
                    <option value="off">全部连线</option>
                    <option value="auto">跨域 / 长线使用标签</option>
                    <option value="all">全部使用标签</option>
                  </select>
                </label>
                <label className="eda-display-check">
                  <input
                    type="checkbox"
                    aria-label="Bus / Hub"
                    checked={bundle}
                    onChange={(e) =>
                      reading.setPart("bundle")(e.target.checked)
                    }
                  />
                  合并关系线（Bus / Hub）
                </label>
                <label className="eda-display-check">
                  <input
                    type="checkbox"
                    checked={settings.edaMetrics === true}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSettings((s) => ({ ...s, edaMetrics: checked }));
                    }}
                  />
                  显示布局指标
                </label>
                <label className="eda-display-check">
                  <input
                    type="checkbox"
                    checked={settings.edaMinimap !== false}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSettings((s) => ({ ...s, edaMinimap: checked }));
                    }}
                  />
                  显示导航小地图
                </label>
                <small>显示设置自动记忆，不修改模型保存时间。</small>
                <details>
                  <summary>操作说明</summary>
                  <p>
                    双击表编辑，拖动空白平移，滚轮缩放。点击领域深入查看，返回总图恢复全部表。
                  </p>
                  <p>
                    虚线含待核关联；实线也不等同于物理外键。点击关系或标签可查看依据及原始成员。
                  </p>
                  <p>
                    1 / N
                    表示一对一或一对多，不是实际记录数；线束的关系数量与基数无关。混合表示同一端口包含不同基数，问号表示尚未定义。
                  </p>
                </details>
              </div>
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
