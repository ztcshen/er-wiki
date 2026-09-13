import { useEffect, useMemo, useRef, useState } from "react";
import { useDiagram, useSettings, useSelect, useLayout } from "@drawdb/hooks";
import { ObjectType, Tab } from "@drawdb/data/constants";
import { modelGroups } from "@drawdb/utils/tableGroups";
import { domainsOf } from "./model.mjs";
import { relationBounds } from "./cardinality.mjs";
import { deriveNets } from "./model.mjs";
import { resolveType } from "@drawdb/utils/customTypes";
import { checkModel } from "../review/model-checks.mjs";
import StructureChecks from "../review/StructureChecks";
import { useReadingSession } from "./useReadingSession";
import { useSchematicLayout } from "./useSchematicLayout";
import { searchModel } from "./reading-state.mjs";
import {
  actualSizeView,
  focusNodeView,
  viewScale,
  zoomAtPoint,
} from "./camera.mjs";
import { tr } from "../i18n/renderer";
import EdaScene from "./EdaScene";
import EdaMinimap from "./EdaMinimap";
import EdaEditors from "./EdaEditors";
import EdaToolbar from "./EdaToolbar";
import EdaDirectory from "./EdaDirectory";
import EdaInspector from "./EdaInspector";
import DiagramExport from "./DiagramExport";
import { useProcessModel } from "../process/context";
import { useProcessReader } from "../process/useProcessReader";
import { actionsForTable, processSelection } from "../process/definition.mjs";
import ProcessWorkspace from "../process/ProcessWorkspace";
import ProcessConfig from "../process/ProcessConfig";
import "../process/process.css";
import "./eda.css";

export default function EdaWorkspace({ modelId, ready }) {
  const {
    tables,
    relationships,
    reviewGroups,
    setGroupView,
    addTable,
    database,
  } = useDiagram();
  const { settings, setSettings } = useSettings();
  const { setSelectedElement, setBulkSelectedElements } = useSelect();
  const { layout, setLayout } = useLayout();
  const { processModel, setProcessModel } = useProcessModel();
  const {
    reader,
    setReader,
    error: processReadingError,
  } = useProcessReader(modelId, ready);
  const [processConfigOpen, setProcessConfigOpen] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);
  const pendingRelation = useRef(null);
  const { scenario, activity } = processSelection(
    processModel,
    reader.scenarioId,
    reader.activityId,
  );
  const processReader = {
    ...reader,
    scenarioId: scenario?.id || "",
    activityId: activity?.id || "",
  };
  const [tools, setTools] = useState(null),
    [search, setSearch] = useState("");
  const [fieldNets, setFieldNets] = useState([]),
    [focusRequest, setFocusRequest] = useState(0);
  const pendingFocus = useRef(null),
    canvas = useRef(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
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
  const model = useMemo(
    () => ({
      tables,
      relationships,
      groups: modelGroups(reviewGroups, tables),
    }),
    [tables, relationships, reviewGroups],
  );
  const reading = useReadingSession(modelId, model, ready);
  const structureIssues = useMemo(
    () =>
      checkModel(model, { typeInfo: (type) => resolveType(database, type) }),
    [model, database],
  );
  const schematic = useSchematicLayout(model, reading, ready);
  const { result, current: currentResult, busy, error } = schematic;
  const { view, setView } = reading;
  const { selectedNet, selectedTable, selectedField } = reading.location;
  const switchMode = (mode) => {
    let nextScenario = scenario,
      nextActivity = activity;
    if (reader.mode === "er" && mode !== "er" && selectedTable != null) {
      const match =
        processModel?.scenarios.find(
          (value) =>
            value.id === scenario?.id &&
            actionsForTable(value, selectedTable, selectedField).length,
        ) ||
        processModel?.scenarios.find(
          (value) =>
            actionsForTable(value, selectedTable, selectedField).length,
        );
      if (match) {
        nextScenario = match;
        const actions = actionsForTable(match, selectedTable, selectedField);
        nextActivity =
          actions.find((value) => value.id === activity?.id) || actions[0];
      }
    }
    setReader((state) => ({
      ...state,
      mode,
      scenarioId: nextScenario?.id || "",
      activityId: nextActivity?.id || "",
    }));
  };
  const setRelation = reading.setPart("selectedRelation");
  const setNet = (value) => {
    reading.setPart("selectedNet")(value);
    setRelation(null);
  };
  const setTable = reading.setPart("selectedTable"),
    setField = reading.setPart("selectedField");
  const domains = useMemo(() => domainsOf(model), [model]);
  const matches = useMemo(() => searchModel(model, search), [model, search]);
  const net = currentResult
    ? result?.projection.nets.find((n) => n.id === selectedNet)
    : null;
  const selectedRelation = net?.members.some(
    (r) => r.id === reading.location.selectedRelation,
  )
    ? reading.location.selectedRelation
    : null;
  const infoTable = tables.find((table) => table.id === selectedTable);
  const fieldInfo = infoTable?.fields.find(
    (field) => field.id === selectedField,
  );
  const visibleTableCount = currentResult
    ? result?.projection.nodes.filter((n) => n.kind === "table").length
    : null;
  const showDirectory = settings.edaDirectory !== false,
    showInspector = checksOpen || !!(net || infoTable);
  useEffect(() => {
    document.body.classList.add("eda-reading");
    setSelectedElement((s) => ({
      ...s,
      element: ObjectType.NONE,
      id: -1,
      open: false,
      openDialogue: false,
    }));
    setBulkSelectedElements([]);
    return () => document.body.classList.remove("eda-reading");
  }, [setSelectedElement, setBulkSelectedElements]);
  const navigate = (...args) => {
    setSearch("");
    setFieldNets([]);
    reading.navigate(...args);
  };
  const clearSelection = () => {
    setNet(null);
    setTable(null);
    setField(null);
    setFieldNets([]);
    reading.setPart("expanded")([]);
  };
  const fitView = () => {
    if (result && currentResult)
      setView([0, 0, result.layout.width || 800, result.layout.height || 500]);
  };
  const zoomView = (factor) => setView((v) => zoomAtPoint(v, factor));
  const tableNode = (id) => {
    const metadata = result?.projection.nodes.find(
      (n) => n.kind === "table" && n.tableId === id,
    );
    return result?.layout.children.find((n) => n.id === metadata?.id);
  };
  const focusTable = (id) => {
    if (!currentResult) return;
    const next = focusNodeView(
      tableNode(id),
      canvas.current?.getBoundingClientRect(),
    );
    if (next) setView(next);
  };
  const focusRelation = () => {
    if (!currentResult || selectedRelation == null) return;
    const next = focusNodeView(
      relationBounds(result, selectedRelation),
      canvas.current?.getBoundingClientRect(),
    );
    if (next) setView(next);
  };
  useEffect(() => {
    if (!currentResult || pendingFocus.current === null) return;
    focusTable(pendingFocus.current);
    pendingFocus.current = null;
  }, [result, currentResult, focusRequest]);
  useEffect(() => {
    if (!currentResult || pendingRelation.current == null) return;
    const next = focusNodeView(
      relationBounds(result, pendingRelation.current),
      canvas.current?.getBoundingClientRect(),
    );
    if (next) setView(next);
    pendingRelation.current = null;
  }, [result, currentResult, focusRequest]);
  const editTable = (id) => {
    if (!tables.some((table) => table.id === id)) return;
    setTools(null);
    setSelectedElement((s) => ({
      ...s,
      element: ObjectType.TABLE,
      id,
      open: false,
      openDialogue: true,
      currentTab: Tab.TABLES,
    }));
  };
  const inspectTable = (id) => {
    if (!tables.some((table) => table.id === id)) return;
    navigate(
      "column",
      domains.find((d) => d.tableIds.includes(id))?.id || "",
      id,
      { selectedTable: id },
    );
  };
  const openModelTools = (code) => {
    setGroupView({ id: "", globalTransform: null });
    setSelectedElement((s) => ({
      ...s,
      element: ObjectType.NONE,
      open: false,
      openDialogue: false,
      currentTab: Tab.TABLES,
    }));
    setLayout((s) => ({ ...s, dbmlEditor: code }));
    setTools("model");
  };
  useEffect(() => {
    const handle = ({ detail }) => {
      const action = typeof detail === "string" ? detail : detail?.action;
      if (action === "check-model") {
        switchMode("er");
        setChecksOpen(true);
        return;
      }
      if (
        reader.mode !== "er" &&
        ["fit", "zoom-in", "zoom-out", "arrange"].includes(action)
      )
        return;
      if (["add-table", "focus-table", "overview"].includes(action))
        switchMode("er");
      if (action === "add-table" && !layout.readOnly) {
        navigate("overview");
        const id = addTable();
        setTable(id);
        setSelectedElement((s) => ({
          ...s,
          element: ObjectType.TABLE,
          id,
          open: false,
          openDialogue: true,
          currentTab: Tab.TABLES,
        }));
      } else if (action === "add-relationship" && !layout.readOnly)
        setTools("relationship");
      else if (action === "model" || action === "code")
        openModelTools(action === "code");
      else if (action === "fit") fitView();
      else if (action === "overview") navigate("overview");
      else if (action === "back") reading.back();
      else if (action === "arrange") schematic.arrange();
      else if (action === "focus-selection") focusTable(selectedTable);
      else if (action === "toggle-directory")
        setSettings((s) => ({ ...s, edaDirectory: s.edaDirectory === false }));
      else if (action === "zoom-in" || action === "zoom-out")
        zoomView(action === "zoom-in" ? 1 / 1.2 : 1.2);
      else if (
        action === "focus-table" &&
        tables.some((table) => table.id === detail.tableId)
      ) {
        const id = detail.tableId;
        setSelectedElement((s) => ({ ...s, open: false, openDialogue: false }));
        navigate(
          "column",
          domains.find((d) => d.tableIds.includes(id))?.id || "",
          id,
          { selectedTable: id, selectedField: detail.fieldId ?? null },
        );
        pendingFocus.current = id;
        setFocusRequest((n) => n + 1);
      }
    };
    window.addEventListener("erwiki-eda-command", handle);
    return () => window.removeEventListener("erwiki-eda-command", handle);
  });
  const inspectorActions = {
    clear: clearSelection,
    selectNet: (id) => {
      setField(null);
      setNet(id);
    },
    selectRelation: setRelation,
    selectRelated: (id) => {
      const relatedNet = result?.projection.nets.find((n) =>
        n.members.some((r) => r.id === id),
      );
      if (!relatedNet) return;
      setNet(relatedNet.id);
      setRelation(id);
      setField(null);
      setFieldNets([]);
    },
    focusRelation,
    editTable,
    inspectTable,
    selectTable: (id) => {
      setTable(id);
      setField(null);
      setNet(null);
      setFieldNets([]);
    },
    inspectField: (tid, fid) => {
      navigate("column", "", tid, { selectedTable: tid, selectedField: fid });
      pendingFocus.current = tid;
      setFocusRequest((n) => n + 1);
    },
    canFocus: currentResult && !!tableNode(selectedTable),
    focus: () => focusTable(selectedTable),
    editRelation: (id) =>
      setSelectedElement((s) => ({
        ...s,
        element: ObjectType.RELATIONSHIP,
        id,
        open: false,
        openDialogue: true,
      })),
    trace: (value) =>
      navigate("table", "", value.targetTableId, {
        selectedNet: value.id,
        selectedRelation,
        selectedTable: null,
        expanded: [...new Set([...reading.location.expanded, value.id])],
      }),
    cancelTrace: () => {
      setNet(null);
      reading.setPart("expanded")([]);
      setFieldNets([]);
    },
  };
  const editIssue = (issue) => {
    if (issue.target.relationshipId != null)
      inspectorActions.editRelation(issue.target.relationshipId);
    else if (issue.target.tableId != null) editTable(issue.target.tableId);
  };
  const locateIssue = (issue) => {
    const relation = relationships.find(
      (r) => r.id === issue.target.relationshipId,
    );
    if (relation) {
      const net = deriveNets(model).find((n) =>
        n.members.some((r) => r.id === relation.id),
      );
      if (net) {
        navigate("overview", "", null, {
          selectedNet: net.id,
          selectedRelation: relation.id,
        });
        pendingRelation.current = relation.id;
        setFocusRequest((n) => n + 1);
        return;
      }
      const table =
        tables.find((t) => t.id === relation.startTableId) ||
        tables.find((t) => t.id === relation.endTableId);
      if (table) {
        inspectTable(table.id);
        pendingFocus.current = table.id;
        setFocusRequest((n) => n + 1);
      } else editIssue(issue);
    } else if (issue.target.tableId != null) {
      const table = tables.find((t) => t.id === issue.target.tableId);
      if (!table) return;
      const fid = table.fields.some((f) => f.id === issue.target.fieldId)
        ? issue.target.fieldId
        : null;
      navigate("column", "", table.id, {
        selectedTable: table.id,
        selectedField: fid,
      });
      pendingFocus.current = table.id;
      setFocusRequest((n) => n + 1);
    }
  };
  const viewSwitcher = (
    <div className="process-view-tabs" role="group" aria-label="模型视图切换">
      <button
        aria-pressed={reader.mode === "er"}
        onClick={() => switchMode("er")}
      >
        ER 结构
      </button>
      <button
        aria-pressed={reader.mode === "flow"}
        onClick={() => switchMode("flow")}
      >
        业务流程
      </button>
    </div>
  );
  return (
    <section
      className="eda-workspace"
      aria-label="EDA 分析工作台"
      data-eda-model={modelId}
    >
      {reader.mode === "flow" && (
        <div className="process-switchbar">
          {viewSwitcher}
          {scenario && (
            <select
              aria-label="业务场景"
              value={scenario.id}
              onChange={(event) => {
                const next = processModel.scenarios.find(
                  (value) => value.id === event.target.value,
                );
                setReader((state) => ({
                  ...state,
                  scenarioId: next.id,
                  activityId:
                    next.steps.find((step) => step.kind === "action")?.id ||
                    next.steps[0]?.id ||
                    "",
                }));
              }}
            >
              {processModel.scenarios.map((value) => (
                <option value={value.id} key={value.id}>
                  {value.name}
                </option>
              ))}
            </select>
          )}
          {activity && <span className="process-context">{activity.name}</span>}
          <button
            className="process-config-button"
            onClick={() => setProcessConfigOpen(true)}
          >
            流程配置
          </button>
        </div>
      )}
      {processReadingError && (
        <p className="eda-warning" role="alert">
          {tr(processReadingError)}
        </p>
      )}
      <div
        className={`process-original-er ${reader.mode !== "er" ? "is-hidden" : ""}`}
      >
        <EdaToolbar
          issues={structureIssues}
          checksOpen={checksOpen}
          onCheck={() => setChecksOpen((value) => !value)}
          leading={reader.mode === "er" ? viewSwitcher : null}
          model={model}
          domains={domains}
          reading={reading}
          settings={settings}
          setSettings={setSettings}
          currentDomain={domains.find(
            (d) => d.id === reading.location.domainId,
          )}
          visibleTableCount={visibleTableCount}
          busy={busy}
          navigate={navigate}
          arrange={schematic.arrange}
        />
        {reading.error && (
          <p role="alert" className="eda-warning">
            {tr(reading.error)}
          </p>
        )}
        <div
          className="eda-body"
          data-directory={showDirectory}
          data-inspector={showInspector}
        >
          {showDirectory && (
            <EdaDirectory
              domains={domains}
              tables={tables}
              matches={matches}
              search={search}
              onSearch={setSearch}
              reading={reading}
              navigate={(...args) => {
                setChecksOpen(false);
                navigate(...args);
              }}
            />
          )}
          <div
            ref={canvas}
            className="eda-canvas"
            data-minimap={settings.edaMinimap !== false}
            id="canvas"
            data-eda-ready={
              ready && result && currentResult && !busy && !error
                ? "true"
                : undefined
            }
          >
            {result && currentResult && (
              <EdaScene
                result={result}
                selectedTable={selectedTable}
                selectedField={selectedField}
                scale={viewScale(view, viewport)}
                semanticZoom={settings.edaSemanticZoom !== false}
                selectedNet={selectedNet}
                selectedRelation={selectedRelation}
                showCardinality={settings.edaCardinality !== false}
                view={view}
                onView={setView}
                onEdit={editTable}
                onNode={(node) => {
                  setChecksOpen(false);
                  if (node.kind === "domain") navigate("domain", node.domainId);
                  else {
                    setTable(node.tableId);
                    setNet(null);
                    setField(null);
                    setFieldNets([]);
                    if (viewScale(view, viewport) < 0.55) {
                      pendingFocus.current = node.tableId;
                      setFocusRequest((n) => n + 1);
                    }
                  }
                }}
                onNet={(value, relationId = null) => {
                  setChecksOpen(false);
                  const ids = Array.isArray(value) ? value : [value];
                  setNet(ids[0] || null);
                  setRelation(relationId);
                  setTable(null);
                  setField(null);
                  setFieldNets(
                    result.projection.nets.filter((n) => ids.includes(n.id)),
                  );
                }}
                onField={(tid, fid) => {
                  setChecksOpen(false);
                  const found = result.projection.nets.filter(
                    (n) =>
                      (n.targetTableId === tid &&
                        n.targetFields.includes(fid)) ||
                      n.members.some(
                        (r) =>
                          r.startTableId === tid &&
                          (r.fields || [r]).some((p) => p.startFieldId === fid),
                      ),
                  );
                  setFieldNets(found);
                  setNet(found[0]?.id || null);
                  setTable(tid);
                  setField(fid);
                }}
              />
            )}
            {!tables.length && (
              <div className="eda-state">
                当前模型尚无表。使用“新增”添加表，或在“更多”中导入模型。
              </div>
            )}
            {(busy || (result && !currentResult && !error)) && (
              <div className="eda-state" role="status">
                正在整理关系…<button onClick={schematic.cancel}>取消</button>
              </div>
            )}
            {error && (
              <div className="eda-state eda-error" role="alert">
                {tr(error)}
                <button onClick={schematic.arrange}>重试</button>
                <button onClick={() => setTools("model")}>打开模型编辑</button>
              </div>
            )}
            {result && currentResult && !busy && !error && (
              <>
                <div className="eda-reading-legend" aria-label="ER 图例">
                  <span className="eda-legend-dot" />
                  {viewScale(view, viewport) < 0.55 &&
                  settings.edaSemanticZoom !== false
                    ? "总览 · 点击表放大阅读"
                    : "字段视图"}
                  <span>1 / N</span>
                  <span className="eda-legend-dash" />
                  待核关联
                </div>
                {settings.edaMinimap !== false && (
                  <EdaMinimap
                    result={result}
                    view={view}
                    viewport={viewport}
                    onView={setView}
                    onFit={fitView}
                  />
                )}
                {settings.edaMetrics === true ? (
                  <div className="eda-metrics">
                    交叉 {result.metrics.crossings} · 重叠{" "}
                    {result.metrics.overlaps} · 线长 {result.metrics.length} ·
                    转角 {result.metrics.bends}
                    <small>
                      按此顺序比较 {result.candidates.length} 个候选，非全局最优
                    </small>
                  </div>
                ) : (
                  !showInspector && (
                    <span className="eda-canvas-hint">
                      双击表编辑 · 拖动空白平移 · 滚轮缩放
                    </span>
                  )
                )}
                <div className="eda-canvas-controls" aria-label="图形导航">
                  <button
                    aria-label="缩小"
                    title="缩小"
                    onClick={() => zoomView(1.2)}
                  >
                    −
                  </button>
                  <button
                    className="eda-scale-button"
                    aria-label="原始大小（100%）"
                    title="原始大小（100%）"
                    onClick={() => setView((v) => actualSizeView(v, viewport))}
                  >
                    {Math.round(viewScale(view, viewport) * 100)}%
                  </button>
                  <button
                    aria-label="适应窗口"
                    title="适应窗口"
                    onClick={fitView}
                  >
                    <i className="bi bi-arrows-fullscreen" aria-hidden="true" />
                  </button>
                  <button
                    aria-label="放大"
                    title="放大"
                    onClick={() => zoomView(1 / 1.2)}
                  >
                    +
                  </button>
                </div>
              </>
            )}
          </div>
          {checksOpen ? (
            <StructureChecks
              onClose={() => setChecksOpen(false)}
              issues={structureIssues}
              onLocate={locateIssue}
              onEdit={editIssue}
              readOnly={layout.readOnly}
            />
          ) : (
            showInspector && (
              <EdaInspector
                selection={{
                  net,
                  table: infoTable,
                  field: fieldInfo,
                  alternatives: fieldNets,
                  selectedRelation,
                }}
                tables={tables}
                relationships={relationships}
                actions={inspectorActions}
                readOnly={layout.readOnly}
              />
            )
          )}
        </div>
      </div>
      {reader.mode !== "er" && (
        <ProcessWorkspace
          model={model}
          definition={processModel}
          scenario={scenario}
          activity={activity}
          reader={processReader}
          setReader={setReader}
          ready={ready}
          selectedTable={selectedTable}
          onSelectActivity={(id) =>
            setReader((state) => ({
              ...state,
              scenarioId: scenario.id,
              activityId: id,
            }))
          }
          onShowER={(id, fieldId = null) => {
            if (!tables.some((table) => table.id === id)) return;
            switchMode("er");
            navigate(
              fieldId != null ? "column" : "overview",
              "",
              fieldId != null ? id : null,
              { selectedTable: id, selectedField: fieldId },
            );
            pendingFocus.current = id;
            setFocusRequest((value) => value + 1);
          }}
          onEditTable={editTable}
          onConfigure={() => setProcessConfigOpen(true)}
        />
      )}
      <ProcessConfig
        open={processConfigOpen}
        onClose={() => setProcessConfigOpen(false)}
        definition={processModel}
        onApply={setProcessModel}
        tables={tables}
        readOnly={layout.readOnly}
      />
      <EdaEditors tools={tools} setTools={setTools} />
      {reader.mode === "er" && (
        <DiagramExport
          model={model}
          result={result}
          current={currentResult && !busy && !error}
          location={reading.location}
          view={view}
          showCardinality={settings.edaCardinality !== false}
          sceneProps={{
            scale: viewScale(view, viewport),
            semanticZoom: settings.edaSemanticZoom !== false,
          }}
        />
      )}
    </section>
  );
}
