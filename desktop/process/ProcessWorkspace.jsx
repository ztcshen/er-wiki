import { useEffect, useMemo, useRef, useState } from "react";
import DiagramExport from "../eda/DiagramExport";
import { createLayoutTask } from "../eda/layout-task.mjs";
import { zoomAtPoint, focusNodeView } from "../eda/camera.mjs";
import { processViewKey } from "./reader.mjs";
import { bindingIssues } from "./definition.mjs";
import ProcessScene from "./ProcessScene";
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
  onSelectActivity,
  onShowER,
  onEditTable,
  onConfigure,
  ready,
}) {
  const [result, setResult] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const canvas = useRef(null),
    job = useRef(null),
    serial = useRef(0);
  const options = useMemo(() => ({ scenario }), [scenario]);
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
    const meta = result.value.projection.nodes.find(
      (node) => node.stepId === activity.id,
    );
    const node = result.value.layout.children.find(
      (node) => node.id === meta?.id,
    );
    const next = focusNodeView(node, canvas.current?.getBoundingClientRect());
    if (next) setView(next);
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
  const issues = bindingIssues(definition, model.tables).filter(
    (issue) => issue.scenarioId === scenario?.id,
  );
  const sceneProps = { selected: activity?.id, onSelect: onSelectActivity };
  return (
    <section className="process-workspace" data-process-mode="flow">
      <div className="process-toolbar">
        <span className="process-mode-description">业务流程图</span>
        <span className="process-muted" title={scenario?.description}>
          流程定义 · 非执行日志
        </span>
        {current && (
          <span className="process-muted">
            {result.value.projection.nodes.length} 个步骤 ·{" "}
            {result.value.projection.mappedTableIds.length} 个关联表
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
        <div
          className="eda-canvas process-canvas"
          ref={canvas}
          data-process-ready={current && !busy && !error ? "true" : undefined}
        >
          {current && (
            <ProcessScene
              result={result.value}
              view={view}
              onView={setView}
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
                <span>箭头：流程顺序</span>
                <span>表结构：点击右侧映射查看</span>
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
        Scene={ProcessScene}
        sceneProps={sceneProps}
      />
    </section>
  );
}
