import { useEffect, useMemo, useRef, useState } from "react";
import catalogue from "./generated/catalogue.json";
import { tr, useLocale } from "./locale";
import EdaScene from "../desktop/eda/EdaScene";
import RelationPopup from '../desktop/eda/RelationPopup';
import EdaMinimap from "../desktop/eda/EdaMinimap";
import EdaInspector from "../desktop/eda/EdaInspector";
import { searchModel } from "../desktop/eda/reading-state.mjs";
import {
  focusNodeView,
  viewScale,
  zoomAtPoint,
  actualSizeView,
} from "../desktop/eda/camera.mjs";
import { relationBounds } from "../desktop/eda/cardinality.mjs";
import "../desktop/eda/eda.css";

const model = catalogue.model;
const blank = { tableId: null, fieldId: null, netId: null, relationId: null };
const bounds = (result) => [
  0,
  0,
  Math.max(300, result.layout.width),
  Math.max(250, result.layout.height),
];
export default function Demo() {
  const { language, setLanguage } = useLocale();
  const [theme, setTheme] = useState("light"),
    [scope, setScope] = useState("overview");
  const [selection, setSelection] = useState(blank),
    [panelOpen, setPanelOpen] = useState(false),
    [directoryOpen, setDirectoryOpen] = useState(false);
  const [relationPopup,setRelationPopup]=useState(null);
  useEffect(()=>setRelationPopup(null),[scope]);
  const [query, setQuery] = useState(""),
    [loaded, setLoaded] = useState(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [views, setViews] = useState({}),
    [viewport, setViewport] = useState({ width: 0, height: 0 }),
    [focusTick, setFocusTick] = useState(0);
  const cache = useRef(new Map()),
    pending = useRef(null),
    canvas = useRef(null),
    search = useRef(null);
  const result = loaded?.key === scope ? loaded.result : null;
  const view = views[scope] || (result ? bounds(result) : [0, 0, 1000, 700]);
  const setView = (value) =>
    setViews((old) => ({
      ...old,
      [scope]:
        typeof value === "function"
          ? value(old[scope] || (result ? bounds(result) : [0, 0, 1000, 700]))
          : value,
    }));
  const fit = () => {
    if (result) setView(bounds(result));
  };
  const table = model.tables.find((value) => value.id === selection.tableId);
  const field = table?.fields.find((value) => value.id === selection.fieldId);
  const net = result?.projection.nets.find(
    (value) => value.id === selection.netId,
  );
  const matches = useMemo(() => searchModel(model, query), [query]);
  const selectedDomain = model.groups.find(
    (group) => "domain:" + group.id === scope,
  );
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    document.body.setAttribute("theme-mode", theme);
  }, [theme]);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setError("");
    if (cache.current.has(scope)) {
      setLoaded({ key: scope, result: cache.current.get(scope) });
      return;
    }
    const controller = new AbortController();
    fetch(new URL(catalogue.scopes[scope].file, document.baseURI), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw Error("HTTP " + response.status);
        return response.json();
      })
      .then((value) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(value?.layout?.children))
          throw Error("Invalid diagram");
        cache.current.set(scope, value);
        setLoaded({ key: scope, result: value });
      })
      .catch((failure) => {
        if (failure.name !== "AbortError")
          setError(tr("布局加载失败，请重试。"));
      });
    return () => controller.abort();
  }, [scope, retry]);
  const focusTable = (id) => {
    if (!result) return;
    const meta = result.projection.nodes.find((value) => value.tableId === id);
    const node = result.layout.children.find((value) => value.id === meta?.id);
    const next = focusNodeView(node, canvas.current?.getBoundingClientRect());
    if (next) setView(next);
  };
  useEffect(() => {
    if (result && pending.current != null && viewport.width) {
      focusTable(pending.current);
      pending.current = null;
    }
  }, [result, focusTick, viewport.width]);
  const overview = () => {
    pending.current = null;
    setScope("overview");
    setSelection(blank);
    setPanelOpen(false);
    setQuery("");
    setDirectoryOpen(false);
    const all = cache.current.get("overview");
    if (all) setViews((old) => ({ ...old, overview: bounds(all) }));
  };
  const domain = (id) => {
    pending.current = null;
    setScope("domain:" + id);
    setSelection(blank);
    setPanelOpen(false);
    setQuery("");
    setDirectoryOpen(false);
  };
  const inspect = (id, fid = null) => {
    if (!model.tables.some((value) => value.id === id)) return;
    setScope("table:" + id);
    setSelection({ tableId: id, fieldId: fid, netId: null, relationId: null });
    setPanelOpen(true);
    setDirectoryOpen(false);
    setQuery("");
    pending.current = id;
    setFocusTick((value) => value + 1);
  };
  const selectNet = (ids, rid = null) => {
    setSelection({
      tableId: null,
      fieldId: null,
      netId: Array.isArray(ids) ? ids[0] : ids,
      relationId: rid,
    });
    setPanelOpen(true);
    setDirectoryOpen(false);
  };
  const focusRelation = () => {
    const next =
      result &&
      focusNodeView(
        relationBounds(result, selection.relationId),
        canvas.current?.getBoundingClientRect(),
      );
    if (next) setView(next);
  };
  useEffect(() => {
    const key = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setDirectoryOpen(true);
        requestAnimationFrame(() => search.current?.focus());
      }
      if (event.key === "Escape") {
        setPanelOpen(false);
        setDirectoryOpen(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const actions = {
    clear: () => setPanelOpen(false),
    selectNet,
    selectRelation: (id) => setSelection((old) => ({ ...old, relationId: id })),
    focusRelation,
    trace: () => {
      overview();
      selectNet(selection.netId, selection.relationId);
    },
    cancelTrace: () => {
      setSelection(blank);
      setPanelOpen(false);
    },
    inspectTable: inspect,
    inspectField: inspect,
    focus: () => focusTable(selection.tableId),
    canFocus: !!result,
    selectRelated: (id) => {
      const related = result.projection.nets.find((value) =>
        value.members.some((relation) => relation.id === id),
      );
      if (related) selectNet(related.id, id);
    },
  };
  return (
    <main className="demo-page eda-workspace">
      <header className="demo-header">
        <a className="demo-brand" href="./" aria-label="ER Wiki">
          <img src="./icon.svg" alt="" />
          <span>
            ER Wiki <small>{tr("在线体验")}</small>
          </span>
        </a>
        <span className="demo-readonly">{tr("只读示例")}</span>
        <nav aria-label="Project">
          <a
            href="https://github.com/ztcshen/er-wiki"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub ↗
          </a>
          <a
            className="demo-download"
            href="https://github.com/ztcshen/er-wiki/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
          >
            {tr("下载桌面版")} ↗
          </a>
        </nav>
        <select
          aria-label={tr("界面语言")}
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
        >
          <option value="en">EN</option>
          <option value="zh">中文</option>
        </select>
        <button
          aria-label={tr("切换主题")}
          title={tr("切换主题")}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
      </header>
      <div className="demo-toolbar">
        <div className="demo-identity">
          <strong>{tr("电商履约")}</strong>
          <span>{tr("虚构结构 · 无业务数据")}</span>
        </div>
        <button
          className="demo-directory-button"
          aria-expanded={directoryOpen}
          onClick={() => setDirectoryOpen(!directoryOpen)}
        >
          {tr("目录")}
        </button>
        <button aria-pressed={scope === "overview"} onClick={overview}>
          {tr("总图")}
        </button>
        <select
          aria-label={tr("领域")}
          value={selectedDomain?.id || ""}
          onChange={(event) =>
            event.target.value ? domain(event.target.value) : overview()
          }
        >
          <option value="">{tr("全部表")}</option>
          {model.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <span className="demo-count" aria-live="polite">
          {result ? catalogue.scopes[scope].tableCount : "…"} /{" "}
          {model.tables.length} · {model.relationships.length} {tr("条关系")}
        </span>
        <button
          className="demo-details-toggle"
          disabled={!table && !net}
          aria-pressed={panelOpen}
          onClick={() => setPanelOpen(!panelOpen)}
        >
          {tr("对象详情")}
        </button>
      </div>
      <div
        className="demo-layout"
        data-details={panelOpen && (!!table || !!net)}
        data-directory={directoryOpen}
      >
        {directoryOpen && (
          <button
            className="demo-scrim"
            aria-label={tr("关闭目录")}
            onClick={() => setDirectoryOpen(false)}
          />
        )}
        <aside className="demo-directory" aria-label={tr("模型目录")}>
          <div className="demo-directory-title">
            <strong>{tr("结构阅读")}</strong>
            <small>13</small>
            <button
              className="demo-close-directory"
              onClick={() => setDirectoryOpen(false)}
              aria-label={tr("关闭目录")}
            >
              ×
            </button>
          </div>
          <input
            ref={search}
            type="search"
            value={query}
            aria-label={tr("搜索模型")}
            placeholder={tr("搜索表、字段、别名或枚举")}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="demo-tree">
            {query ? (
              <>
                {!matches.length && <p>{tr("没有匹配结果")}</p>}
                {matches.slice(0, 80).map(({ table, field }) => (
                  <button
                    className="demo-search-result"
                    key={table.id + ":" + (field?.id || "")}
                    onClick={() => inspect(table.id, field?.id ?? null)}
                  >
                    <span>
                      {table.name}
                      {field ? "." + field.name : ""}
                    </span>
                    <small>
                      {field?.reviewChineseName || field?.comment || ""}
                    </small>
                  </button>
                ))}
              </>
            ) : (
              model.groups.map((group) => (
                <section key={group.id}>
                  <button
                    className="demo-group"
                    style={{ borderColor: group.color }}
                    onClick={() => domain(group.id)}
                  >
                    <strong>{group.name}</strong>
                    <span>{group.tableIds.length}</span>
                  </button>
                  {group.tableIds.map((id) => (
                    <button
                      className="demo-table-link"
                      aria-current={
                        selection.tableId === id ? "true" : undefined
                      }
                      key={id}
                      onClick={() => inspect(id)}
                    >
                      <span style={{ background: group.color }} />
                      {model.tables.find((value) => value.id === id).name}
                    </button>
                  ))}
                </section>
              ))
            )}
          </div>
          <footer>
            <p>{tr("完整编辑、导入与保存请使用桌面版。")}</p>
            <small>
              AGPL-3.0 ·{" "}
              <a href="./LICENSE.txt" target="_blank" rel="noopener noreferrer">
                License
              </a>{" "}
              ·{" "}
              <a
                href="./THIRD_PARTY.txt"
                target="_blank"
                rel="noopener noreferrer"
              >
                Credits
              </a>
            </small>
          </footer>
        </aside>
        <div
          className="demo-canvas eda-canvas"
          ref={canvas}
          data-demo-ready={
            result && !error && viewport.width > 0 && viewport.height > 0
              ? "true"
              : undefined
          }
        >
          {result && (
            <EdaScene
              result={result}
              selectedNet={selection.netId}
              selectedRelation={selection.relationId}
              selectedTable={selection.tableId}
              selectedField={selection.fieldId}
              view={view}
              onView={setView}
              scale={viewScale(view, viewport)}
              onNode={(node) => inspect(node.tableId)}
              onEdit={(id) => inspect(id)}
              onField={inspect}
              onNet={selectNet}
              onExplain={setRelationPopup}
            />
          )}
          {!result && !error && (
            <div className="eda-state" role="status">
              {tr("正在载入示例…")}
            </div>
          )}
          {error && (
            <div className="eda-state" role="alert">
              <p>{error}</p>
              <button onClick={() => setRetry((value) => value + 1)}>
                {tr("重试")}
              </button>
            </div>
          )}
          {result && (
            <>
              <div className="demo-legend">
                <span className="demo-status-dot" />
                {tr("只读示例")}
                <span>1 / N</span>
                <small>{tr("关系追踪")}</small>
              </div>
              <EdaMinimap
                result={result}
                view={view}
                viewport={viewport}
                onView={setView}
                onFit={fit}
              />
              <div className="eda-canvas-controls">
                <button
                  aria-label={tr("缩小")}
                  onClick={() => setView((value) => zoomAtPoint(value, 1.2))}
                >
                  −
                </button>
                <button
                  className="eda-scale-button"
                  aria-label={tr("原始大小（100%）")}
                  onClick={() =>
                    setView((value) => actualSizeView(value, viewport))
                  }
                >
                  {Math.round(viewScale(view, viewport) * 100)}%
                </button>
                <button aria-label={tr("适应窗口")} onClick={fit}>
                  ↔
                </button>
                <button
                  aria-label={tr("放大")}
                  onClick={() =>
                    setView((value) => zoomAtPoint(value, 1 / 1.2))
                  }
                >
                  +
                </button>
              </div>
            </>
          )}
        </div>
        {result && panelOpen && (table || net) && (
          <EdaInspector
            selection={{
              table,
              field,
              net,
              alternatives: [],
              selectedRelation: selection.relationId,
            }}
            tables={model.tables}
            relationships={model.relationships}
            actions={actions}
            readOnly
          />
        )}
      </div>
      <footer className="demo-footer">
        <span>{tr("在线示例只提供结构阅读；不连接数据库，不上传输入。")}</span>
        <details>
          <summary>{tr("阅读提示")}</summary>
          <p>
            {tr("鼠标拖动平移，滚轮缩放。手机可单指拖动，使用加减按钮缩放。")}
          </p>
        </details>
      </footer>
      {relationPopup&&<RelationPopup request={relationPopup} tables={model.tables} relationships={model.relationships} onClose={()=>setRelationPopup(null)}/>}
    </main>
  );
}
