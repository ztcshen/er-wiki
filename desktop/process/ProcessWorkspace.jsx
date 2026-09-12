import { useEffect, useMemo, useRef, useState } from "react";
import EdaScene from "../eda/EdaScene";
import DiagramExport from "../eda/DiagramExport";
import { createLayoutTask } from "../eda/layout-task.mjs";
import { zoomAtPoint, focusNodeView } from "../eda/camera.mjs";
import { processViewKey } from "./reader.mjs";
import { actionsForTable, bindingIssues } from "./definition.mjs";
import { ProcessNode, ProcessEdge } from "./ProcessGlyphs";
import ProcessInspector from "./ProcessInspector";
import { tr } from "../i18n/renderer";

export default function ProcessWorkspace({
  model,
  definition,
  scenario,
  activity,
  reader,
  setReader,
  selectedTable,
  selectedField,
  onSelectActivity,
  onSelectTable,
  onShowER,
  onEditTable,
  onConfigure,
  ready,
}) {
  const [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [net, setNet] = useState(null),
    [relation, setRelation] = useState(null);
  const canvas = useRef(null),
    job = useRef(null),
    serial = useRef(0);
  const scopeActivity =
    reader.mode === "mixed" && reader.mixedScope === "focused"
      ? activity?.id
      : "";
  const options = useMemo(
    () => ({
      scenario,
      mode: reader.mode,
      scope: reader.mixedScope,
      activityId: scopeActivity,
    }),
    [scenario, reader.mode, reader.mixedScope, scopeActivity],
  );
  const viewKey = processViewKey(reader),
    remembered = reader.views[viewKey],
    view = remembered || [0, 0, 1000, 700];
  const setView = (value) =>
    setReader((state) => ({
      ...state,
      views: {
        ...state.views,
        [viewKey]:
          typeof value === "function"
            ? value(state.views[viewKey] || [0, 0, 1000, 700])
            : value,
      },
    }));
  const input = useMemo(
    () => ({ model, options, revision }),
    [model, options, revision],
  );
  const current = result?.input === input;
  useEffect(() => {
    if (!ready || !scenario || !scenario.steps.length) {
      setResult(null);
      setBusy(false);
      setError("");
      return;
    }
    const sequence = ++serial.current;
    setBusy(true);
    setError("");
    const task = createLayoutTask(
      () =>
        new Worker(new URL("./layout.worker.js", import.meta.url), {
          type: "module",
        }),
      model,
      options,
    );
    job.current = task;
    task.promise
      .then((value) => {
        if (serial.current !== sequence) return;
        setResult({ input, value });
        setBusy(false);
        if (!remembered)
          setView([
            0,
            0,
            Math.max(300, value.layout.width),
            Math.max(250, value.layout.height),
          ]);
      })
      .catch((failure) => {
        if (serial.current === sequence) {
          setError(failure.message);
          setBusy(false);
        }
      });
    return () => {
      serial.current++;
      task.cancel();
    };
  }, [input, ready]);
  const fit = () => {
    if (current)
      setView([
        0,
        0,
        Math.max(300, result.value.layout.width),
        Math.max(250, result.value.layout.height),
      ]);
  };
  const focus = () => {
    if (!current || !activity) return;
    const nodes = result.value.layout.children.filter((node) => {
      const meta = result.value.projection.nodes.find(
        (item) => item.id === node.id,
      );
      return (
        meta.stepId === activity.id ||
        (reader.mode === "mixed" &&
          activity.bindings.some((binding) => binding.tableId === meta.tableId))
      );
    });
    if (!nodes.length) return;
    const x = Math.min(...nodes.map((node) => node.x)),
      y = Math.min(...nodes.map((node) => node.y));
    const next = focusNodeView(
      {
        x,
        y,
        width: Math.max(...nodes.map((node) => node.x + node.width)) - x,
        height: Math.max(...nodes.map((node) => node.y + node.height)) - y,
      },
      canvas.current?.getBoundingClientRect(),
    );
    if (next) setView(next);
  };
  const select = (id) => {
    onSelectActivity(id);
    setNet(null);
    setRelation(null);
  };
  const zoom = (factor) => setView((value) => zoomAtPoint(value, factor));
  useEffect(() => {
    const handler = ({ detail }) => {
      const action = typeof detail === "string" ? detail : detail?.action;
      if (action === "fit") fit();
      else if (action === "arrange") setRevision((value) => value + 1);
      else if (action === "zoom-in" || action === "zoom-out")
        zoom(action === "zoom-in" ? 1 / 1.2 : 1.2);
    };
    window.addEventListener("erwiki-eda-command", handler);
    return () => window.removeEventListener("erwiki-eda-command", handler);
  });
  const related = actionsForTable(scenario, selectedTable, selectedField),
    issues = bindingIssues(definition, model.tables).filter(
      (issue) => issue.scenarioId === scenario?.id,
    );
  const sceneProps = {
    renderNode: (node, meta) => (
      <ProcessNode node={node} meta={meta} selected={activity?.id} />
    ),
    renderEdge: (edge, meta) => (
      <ProcessEdge
        edge={edge}
        meta={meta}
        selected={activity?.id}
        onSelect={select}
      />
    ),
    highlightBindings: activity?.bindings || [],
  };
  return (
    <section className="process-workspace" data-process-mode={reader.mode}>
      <div className="process-toolbar">
        <span className="process-mode-description">
          {reader.mode === "flow"
            ? "方案 A · 独立流程视图"
            : "方案 B · 混合 EDA 视图"}
        </span>
        <span className="process-muted" title={scenario?.description}>
          流程定义 · 非执行日志
        </span>
        {reader.mode === "mixed" && (
          <select
            aria-label="混合视图范围"
            value={reader.mixedScope}
            onChange={(event) =>
              setReader((state) => ({
                ...state,
                mixedScope: event.target.value,
              }))
            }
          >
            <option value="focused">当前动作与邻居</option>
            <option value="all">整个场景</option>
          </select>
        )}
        {current && (
          <span className="process-muted">
            {result.value.projection.nodes.filter((node) => node.stepId).length}{" "}
            个步骤 ·{" "}
            {
              result.value.projection.nodes.filter(
                (node) => node.kind === "table",
              ).length
            }{" "}
            / {model.tables.length} 表
          </span>
        )}
        <button onClick={focus} disabled={!current}>
          定位动作
        </button>
        <button onClick={fit} disabled={!current}>
          适应流程
        </button>
      </div>
      <div className="process-body">
        <aside className="eda-directory process-directory">
          <div className="eda-directory-heading">
            <strong>业务步骤</strong>
            <span>{scenario?.steps.length || 0}</span>
          </div>
          <p className="process-muted">
            {scenario?.evidence || "流程来自模型配置，非实际执行日志。"}
          </p>
          {selectedTable != null && (
            <p className="process-context">
              {model.tables.find((table) => table.id === selectedTable)?.name} ·{" "}
              {related.length} 个关联动作
            </p>
          )}
          <div className="process-step-list">
            {scenario?.steps.map((step, index) => (
              <button
                key={step.id}
                aria-pressed={step.id === activity?.id}
                data-process-step-link={step.id}
                data-related={related.some((item) => item.id === step.id)}
                onClick={() => select(step.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step.name}</strong>
                <small>
                  {step.kind === "decision"
                    ? "分支"
                    : step.kind === "event"
                      ? "事件"
                      : "动作"}
                </small>
              </button>
            ))}
          </div>
          <details className="process-evidence">
            <summary>场景说明与边界</summary>
            <p>{scenario?.description}</p>
          </details>
        </aside>
        <div
          className="eda-canvas process-canvas"
          ref={canvas}
          data-process-ready={current && !busy && !error ? "true" : undefined}
        >
          {current && (
            <EdaScene
              result={result.value}
              view={view}
              onView={setView}
              selectedNet={net}
              selectedRelation={relation}
              onNet={(ids, id) => {
                setNet(Array.isArray(ids) ? ids[0] : ids);
                setRelation(id);
              }}
              onNode={(meta) => {
                if (meta.stepId) select(meta.stepId);
                else if (meta.tableId != null) onSelectTable(meta.tableId);
              }}
              onEdit={onEditTable}
              onField={onShowER}
              {...sceneProps}
            />
          )}
          {(!scenario || !scenario.steps.length) && (
            <div className="eda-state">
              <p>当前模型还没有流程定义。</p>
              <p>ER 关系不会自动变成业务流程。</p>
              <button onClick={onConfigure}>配置流程</button>
            </div>
          )}
          {busy && (
            <div className="eda-state" role="status">
              正在整理流程…
              <button
                onClick={() => {
                  serial.current++;
                  job.current?.cancel();
                  setBusy(false);
                  setError("已取消布局，原模型未改变。");
                }}
              >
                取消
              </button>
            </div>
          )}
          {error && (
            <div className="eda-state" role="alert">
              {tr(error)}
              <button onClick={() => setRevision((value) => value + 1)}>
                重试
              </button>
            </div>
          )}
          {current && (
            <>
              <div className="process-legend">
                <span>实线箭头：流程</span>
                <span>彩色点线：读写</span>
                {reader.mode === "mixed" && <span>1 / N：表关系</span>}
              </div>
              <div className="eda-canvas-controls">
                <button aria-label="缩小流程" onClick={() => zoom(1.2)}>
                  −
                </button>
                <button aria-label="适应流程图" onClick={fit}>
                  ↔
                </button>
                <button aria-label="放大流程" onClick={() => zoom(1 / 1.2)}>
                  +
                </button>
              </div>
            </>
          )}
        </div>
        <ProcessInspector
          activity={activity}
          tables={model.tables}
          onShowER={onShowER}
          onEditTable={onEditTable}
          selectedTable={selectedTable}
        />
      </div>
      {issues.length > 0 && (
        <details className="process-issues" role="alert">
          <summary>{issues.length} 处表字段映射失效，未自动删除流程</summary>
          {issues.map((issue, index) => (
            <p key={index}>{issue.message}</p>
          ))}
        </details>
      )}
      <DiagramExport
        model={model}
        result={result?.value}
        current={current && !busy && !error}
        location={{}}
        view={view}
        viewOnly
        sceneProps={sceneProps}
      />
    </section>
  );
}
