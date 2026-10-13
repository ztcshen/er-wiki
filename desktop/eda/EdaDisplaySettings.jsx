import ReadingBookmarks from "./ReadingBookmarks";
import { tr } from '../i18n/renderer';
import { normalizeDisplayOptions, displayOptionsPatch } from './display-options.mjs';

const displayGroups = [
  { title: '显示内容', options: [
    ['edaGrid', '显示网格'],
    ['edaCardinality', '显示关系基数（1 / N）'],
    ['edaRelationLabels', '显示关系说明'],
    ['edaPortMarkers', '显示连接端点'],
    ['edaMinimap', '显示导航小地图'],
  ] },
  { title: '聚焦阅读', options: [
    ['edaDimOthers', '淡化无关对象'],
    ['edaSemanticZoom', '缩小时突出表名'],
  ] },
];

export default function EdaDisplaySettings({
  model,
  reading,
  settings,
  setSettings,
  navigate,
  embedded = false,
}) {
  const display = normalizeDisplayOptions(settings);
  const { level, selectedTable, tableId, domainId, labels, bundle, direction } =
    reading.location;
  return (
    <div className={`eda-display-panel${embedded ? ' is-docked' : ''}`}>
      {!embedded && <strong>图形显示</strong>}
      {displayGroups.map(group => <fieldset className="eda-display-group" key={group.title}>
        <legend>{tr(group.title)}</legend>
        {group.options.map(([key, label]) => <label className="eda-display-check" key={key}>
          <input type="checkbox" data-display-setting={key} checked={display[key]}
            onChange={event => { const checked = event.target.checked; setSettings(value => ({ ...value, ...displayOptionsPatch({ [key]: checked }) })); }}/>
          {tr(label)}
        </label>)}
      </fieldset>)}
      <small>{tr('关系说明开关保留 Net Label 与关系连线。')}</small>
      <details>
        <summary>高级显示</summary>
        <label>
          布局方向
          <select
            aria-label="布局方向"
            value={direction}
            onChange={(e) => reading.setPart("direction")(e.target.value)}
          >
            <option value="AUTO">自动（保持横向阅读）</option>
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
            onChange={(e) => reading.setPart("bundle")(e.target.checked)}
          />
          合并关系线（Bus / Hub）
        </label>
        <label className="eda-display-check">
          <input
            type="checkbox"
            data-display-setting="edaMetrics"
            checked={display.edaMetrics}
            onChange={(e) => {
              const checked = e.target.checked;
              setSettings((s) => ({ ...s, ...displayOptionsPatch({ edaMetrics: checked }) }));
            }}
          />
          显示布局指标
        </label>
      </details>
      <small>显示设置自动记忆，不修改模型保存时间。</small>
      <details>
        <summary>阅读书签</summary>
        <ReadingBookmarks session={reading} embedded />
      </details>
      <details>
        <summary>视图范围</summary>
        <label>
          图形层级
          <select
            aria-label="原理图层级"
            value={level}
            onChange={(event) => {
              const next = event.target.value;
              const target = ["table", "column"].includes(next)
                ? selectedTable ?? tableId ?? model.tables[0]?.id
                : null;
              navigate(
                next,
                ["overview", "system"].includes(next) ? "" : domainId,
                target,
              );
            }}
          >
            <option value="overview">全部表</option>
            <option value="system">领域概览</option>
            <option value="domain">领域内表</option>
            <option value="table" disabled={!model.tables.length}>
              关联表
            </option>
            <option value="column" disabled={!model.tables.length}>
              全部字段
            </option>
          </select>
        </label>
      </details>
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
  );
}
