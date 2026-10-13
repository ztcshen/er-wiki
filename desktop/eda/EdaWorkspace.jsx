import { useEffect, useMemo, useRef, useState } from "react";
import { useDiagram, useSettings, useSelect, useLayout } from "@drawdb/hooks";
import { ObjectType, Tab } from "@drawdb/data/constants";
import { modelGroups } from "@drawdb/utils/tableGroups";
import { domainsOf } from "./model.mjs";
import { relationBounds } from "./cardinality.mjs";
import { deriveNets } from "./model.mjs";
import { SELF_REFERENCE_COLOR } from './presentation.mjs';
import { focusRelationshipIds } from './field-selection.mjs';
import { resolveType } from "@drawdb/utils/customTypes";
import { checkModel } from "../review/model-checks.mjs";
import StructureChecks from "../review/StructureChecks";
import { useReadingSession } from "./useReadingSession";
import { useSchematicLayout } from "./useSchematicLayout";
import { scopeKey } from "./reading-state.mjs";
import { useModelIndex } from './useModelIndex';
import { searchModelIndex } from './model-index.mjs';
import { useFrameValue } from './useFrameValue';
import { useReadingPersistence } from './useReadingPersistence';
import { useReadingWorkspaces } from './useReadingWorkspaces';
import { contextLayout } from './reading-layout.mjs';
import ReadingWorkbenchBar from './ReadingWorkbenchBar';
import ReadingContextPane from './ReadingContextPane';
import ObjectReferences from './ObjectReferences';
import ReviewQueries from './ReviewQueries';
import ReviewQueryEditor from './ReviewQueryEditor';
import { validateReviewQueries, cleanReviewQuery } from './review-queries.mjs';
import { assertReadableDraft } from '../renderer/model-content.mjs';
import {
  actualSizeView,
  focusNodeView,
  focusFieldView,
  viewScale,
  zoomAtPoint,
  layoutViewBox,
} from "./camera.mjs";
import { tr } from "../i18n/renderer";
import EdaScene from "./EdaScene";
import RelationPopup from './RelationPopup';
import EdaMinimap from "./EdaMinimap";
import EdaEditors from "./EdaEditors";
import EdaToolbar from "./EdaToolbar";
import EdaDirectory from "./EdaDirectory";
import EdaInspector from "./EdaInspector";
import EdaDisplaySettings from "./EdaDisplaySettings";
import DocumentProperties from "./DocumentProperties";
import WorkbenchStatus from "./WorkbenchStatus";
import { normalizeDisplayOptions, displayOptionsPatch } from "./display-options.mjs";
import DiagramViewEditor from './DiagramViewEditor';
import DiagramViewsBar from './DiagramViewsBar';
import CandidateRelationships from './CandidateRelationships';
import ReadingExport from './ReadingExport';
import { captureViewGeometry, reconcileDiagramViews, moveViewDepict, resetViewGeometry } from './diagram-views.mjs';
import { isCandidateRelation } from '../review/relation-semantics.mjs';
import DiagramExport from "./DiagramExport";
import { useProcessModel } from "../process/context";
import { useProcessReader } from "../process/useProcessReader";
import { actionsForTable, processSelection } from "../process/definition.mjs";
import ProcessWorkspace from "../process/ProcessWorkspace";
import ProcessConfig from "../process/ProcessConfig";
import "../process/process.css";
import "./eda.css";
import './diagram-views.css';
import './reading-workbench.css';
import '../renderer/engineering-workbench.css';

export default function EdaWorkspace({ modelId, ready, title = 'ER Wiki', diagramViews = [], setDiagramViews, reviewQueries = [], setReviewQueries, modelMetadata = {} }) {
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
  const [viewEditor, setViewEditor] = useState(false), [readingExport, setReadingExport] = useState(false);
  const [candidatesOpen, setCandidatesOpen] = useState(false), [dragPreview, setDragPreview] = useState(null), [viewError, setViewError] = useState('');
  const [queryEditor, setQueryEditor] = useState(false);
  const pendingRelation = useRef(null);
  const [relationPopup,setRelationPopup]=useState(null);
  useEffect(()=>setRelationPopup(null),[modelId,reader.mode]);
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
    pendingFit = useRef(false),
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
      database, title, diagramViews, reviewQueries,
      metadata: modelMetadata,
    }),
    [tables, relationships, reviewGroups, database, title, diagramViews, reviewQueries, modelMetadata],
  );
  const indexed = useModelIndex(model, ready);
  const reading = useReadingSession(modelId, model, ready && indexed.ready);
  const activeView = diagramViews.find(v => v.id === reading.location.diagramViewId);
  const editableView = activeView && reading.location.level === 'overview' && !layout.readOnly;
  useEffect(() => {
    if (!ready || !setDiagramViews) return;
    const next = reconcileDiagramViews(diagramViews, tables);
    if (JSON.stringify(next) !== JSON.stringify(diagramViews)) setDiagramViews(next);
  }, [ready, tables, diagramViews, setDiagramViews]);
  const structureIssues = useMemo(
    () =>
      checkModel(model, { typeInfo: (type) => resolveType(database, type) }),
    [model, database],
  );
  const schematic = useSchematicLayout(modelId, model, reading, ready && indexed.ready);
  const { result, current: currentResult, busy, error } = schematic;
  const { view } = reading;
  const camera = useFrameValue(view, reading.setView, schematic.key);
  const dragFrames = useFrameValue(dragPreview, setDragPreview, schematic.key);
  const setView = camera.set;
  const settled = ready && indexed.ready && (!tables.length || result && currentResult && !busy || Boolean(error));
  useReadingPersistence(modelId, reading, settled, camera);
  const workspaces = useReadingWorkspaces(modelId, settled);
  const context = reading.layout.children.find(item => item.id === 'context');
  const openContext = active => {
    setChecksOpen(false); setCandidatesOpen(false);
    reading.setReadingLayout(value => contextLayout(value, { active, visible: true }));
  };
  useEffect(() => {
    if (reading.location.selectedTable != null || reading.location.selectedNet != null)
      reading.setReadingLayout(value => contextLayout(value, { visible: true }));
  }, [reading.location.selectedTable, reading.location.selectedField, reading.location.selectedNet]);
  const saveWorkspace = name => {
    if (!settled) return false;
    camera.flush();
    const state = reading.getState(), k = scopeKey(state.location);
    return workspaces.save(name, { location: state.location, view: state.views[k] || camera.latest,
      collapsedDomains: state.collapsedDomains, layout: { ...state.layout, directoryVisible: showDirectory }, queryId: state.queryId });
  };
  const loadWorkspace = id => {
    const saved = workspaces.workspaces.find(w => w.id === id); if (!saved || !settled) return false;
    try { assertReadableDraft(document); } catch { setViewError(tr('请完成或取消当前编辑后切换工作区')); return false; }
    camera.clear(); dragFrames.clear(); setDragPreview(null); setSearch(''); setFieldNets([]); setChecksOpen(false); setCandidatesOpen(false);
    reading.restoreWorkspace(saved.snapshot); setViewError(''); switchMode('er'); return true;
  };
  const saveQuery = query => {
    if (layout.readOnly || !setReviewQueries) return false;
    validateReviewQueries([query]); const next = cleanReviewQuery(query);
    setReviewQueries(values => values.some(q => q.id === next.id) ? values.map(q => q.id === next.id ? next : q) : [...values, next]);
    reading.setQueryId(next.id); setQueryEditor(false); openContext('queries'); return true;
  };
  const { selectedNet, selectedTable, selectedField } = reading.location;
  const selectedRelationshipIds = useMemo(() => focusRelationshipIds(relationships, { selectedTable, selectedField, selectedNet }), [relationships, selectedTable, selectedField, selectedNet]);
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
  const matches = useMemo(() => indexed.ready ? searchModelIndex(indexed.index, model, search) : [], [model, search, indexed.index, indexed.ready]);
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
  const showDirectory = reading.layout.directoryVisible ?? (settings.edaDirectory !== false),
    showInspector = checksOpen || candidatesOpen || context.visible;
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
    camera.clear(); dragFrames.clear();
    setSearch("");
    setFieldNets([]);
    if (!Object.hasOwn(args[3] || {}, 'diagramViewId')) args[3] = { ...args[3], diagramViewId: '' };
    reading.navigate(...args);
  };
  const selectView = id => {
    setViewError(''); setDragPreview(null);
    navigate('overview', '', null, { diagramViewId: id });
  };
  const saveView = next => {
    if (layout.readOnly || !setDiagramViews) return;
    setDiagramViews(views => views.some(v => v.id === next.id) ? views.map(v => v.id === next.id ? next : v) : [...views, next]);
    setViewEditor(false); selectView(next.id);
  };
  const capturePositions = () => {
    if (!editableView || !currentResult) return;
    setDiagramViews(views => views.map(v => v.id === activeView.id ? captureViewGeometry(v, result) : v));
  };
  const moveTable = (tableId, x, y) => {
    dragFrames.clear(); setDragPreview(null);
    if (!editableView || !currentResult) return;
    const node = tableNode(tableId);
    if (!node) return;
    const nx = Math.max(40, x), ny = Math.max(40, y);
    const meta = new Map(result.projection.nodes.map(n => [n.id, n]));
    const collision = result.layout.children.some(other => other.id !== node.id && meta.get(other.id)?.kind === 'table' && nx < other.x + other.width + 12 && nx + node.width + 12 > other.x && ny < other.y + other.height + 12 && ny + node.height + 12 > other.y);
    if (collision) { setViewError(tr('该位置会与其它表重叠，请留出连线空间')); return; }
    setViewError('');
    setDiagramViews(views => views.map(v => v.id === activeView.id ? moveViewDepict(v, result, tableId, nx, ny) : v));
  };
  const arrangeCurrent = () => {
    setViewError('');
    if (editableView && activeView.depicts.some(d => d.x !== undefined)) setDiagramViews(views => views.map(v => v.id === activeView.id ? resetViewGeometry(v) : v));
    else schematic.arrange();
  };
  const locateCandidate = relation => {
    const value = deriveNets(model, { showCandidates: true }).find(n => n.members.some(r => r.id === relation.id));
    navigate('overview', '', null, { diagramViewId: '', showCandidates: true, selectedNet: value?.id, selectedRelation: relation.id });
    pendingRelation.current = relation.id; setFocusRequest(n => n + 1);
  };
  const locateReference = relation => {
    const value = deriveNets(model, { showCandidates: true }).find(n => n.members.some(r => r.id === relation.id));
    navigate('overview', '', null, { diagramViewId: '', showCandidates: isCandidateRelation(relation), selectedNet: value?.id || null, selectedRelation: relation.id,
      selectedTable: value ? null : tables.some(t => t.id === relation.startTableId) ? relation.startTableId : null });
    pendingRelation.current = relation.id; setFocusRequest(n => n + 1);
  };
  const locateQueryResult = row => {
    if (row.type === 'relationship') { const relation = relationships.find(r => r.id === row.relationshipId); if (relation) locateReference(relation); return; }
    if (row.type === 'field') selectField(row.tableId, row.fieldId, true);
    else { navigate('column', domains.find(d => d.tableIds.includes(row.tableId))?.id || '', row.tableId, { selectedTable: row.tableId }); pendingFocus.current = row.tableId; setFocusRequest(n => n + 1); }
  };
  const clearSelection = () => {
    reading.setReadingLayout(value => contextLayout(value, { active: 'details' }));
    pendingFocus.current = null;
    pendingRelation.current = null;
    setNet(null);
    setTable(null);
    setField(null);
    setFieldNets([]);
    reading.setPart("expanded")([]);
  };
  const fitView = () => {
    if (result && currentResult)
      setView(layoutViewBox(result));
  };
  const zoomView = (factor) => setView((v) => zoomAtPoint(v, factor));
  useEffect(() => {
    if (!pendingFit.current || !currentResult || busy || !result) return;
    pendingFit.current = false;
    fitView();
  }, [result, currentResult, busy, focusRequest]);
  const tableNode = (id) => {
    const metadata = result?.projection.nodes.find(
      (n) => n.kind === "table" && n.tableId === id,
    );
    return result?.layout.children.find((n) => n.id === metadata?.id);
  };
  const focusTable = (id, fieldId = null) => {
    if (!currentResult) return;
    const next = fieldId != null ? focusFieldView(tableNode(id),
      result?.projection.nodes.find(n => n.kind === 'table' && n.tableId === id)?.fields,
      fieldId, canvas.current?.getBoundingClientRect()) : focusNodeView(
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
  const selectField = (tid, fid, focus = false) => {
    pendingFocus.current = null;
    pendingRelation.current = null;
    setChecksOpen(false);
    const projected = currentResult && result?.projection.nodes.some(n => n.kind === 'table' && n.tableId === tid && n.fields?.some(f => f.id === fid));
    if (focus && !projected) navigate('column', '', tid, { selectedTable: tid, selectedField: fid });
    else { setTable(tid); setField(fid); setNet(null); setFieldNets([]); }
    if (focus) { pendingFocus.current = tid; setFocusRequest(n => n + 1); }
  };
  const locateTableInView = id => {
    if (!currentResult || !tableNode(id)) return false;
    setTable(id); setField(null); setNet(null); setFieldNets([]);
    pendingRelation.current = null; pendingFocus.current = id;
    setFocusRequest(n => n + 1);
    return true;
  };
  useEffect(() => {
    if (!currentResult || pendingFocus.current === null) return;
    focusTable(pendingFocus.current, pendingFocus.current === selectedTable ? selectedField : null);
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
      if (action === "model-replaced") {
        setQueryEditor(false);
        switchMode("er");
        setChecksOpen(false);
        setTools(null);
        pendingFocus.current = null;
        pendingRelation.current = null;
        pendingFit.current = true;
        navigate("overview");
        setFocusRequest((n) => n + 1);
        return;
      }
      if (action === "check-model") {
        switchMode("er");
        reading.setReadingLayout(value => contextLayout(value, { active: 'details', visible: true }));
        setChecksOpen(true);
        return;
      }
      if (action === 'new-reading-view' && !layout.readOnly) { switchMode('er'); setViewEditor(true); return; }
      if (action === 'export-reader') { if (settled) setReadingExport(true); return; }
      if (action === 'show-properties') { switchMode('er'); openContext('details'); return; }
      if (action === 'show-view-configuration') { switchMode('er'); openContext('display'); return; }
      if (action === 'clear-focus') { clearSelection(); return; }
      if (action === 'set-display-options') { const patch = displayOptionsPatch(detail.options); setSettings(value => ({ ...value, ...patch })); detail.resolve?.(patch); return; }
      if (action === 'select-reading-view' && (detail.id === '' || diagramViews.some(v => v.id === detail.id))) { selectView(detail.id); return; }
      if (action === 'show-object-references') { openContext('references'); return; }
      if (action === 'show-review-queries') { openContext('queries'); return; }
      if (action === 'new-review-query' && !layout.readOnly) { openContext('queries'); setQueryEditor(true); return; }
      if (action === 'save-reading-workspace') { detail?.resolve?.(saveWorkspace(detail.name || '阅读工作区')); return; }
      if (action === 'load-reading-workspace') { detail?.resolve?.(loadWorkspace(detail.id)); return; }
      if (action === 'set-reading-layout') { reading.setReadingLayout(value => ({ ...contextLayout(value, { active: detail.context || context.active, visible: detail.visible !== false }), direction: detail.direction || value.direction, directoryVisible: detail.directoryVisible ?? value.directoryVisible })); return; }
      if (action === 'select-reading-query') { reading.setQueryId(detail.id); openContext('queries'); return; }
      if (action === 'save-review-query' && !layout.readOnly) { try { detail.resolve?.(saveQuery(detail.query)); } catch (e) { detail.resolve?.({ error: e.message }); } return; }
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
      else if (action === "arrange") arrangeCurrent();
      else if (action === "focus-selection") focusTable(selectedTable, selectedField);
      else if (action === "toggle-directory")
        reading.setReadingLayout(value => ({ ...value, directoryVisible: !showDirectory }));
      else if (action === "zoom-in" || action === "zoom-out")
        zoomView(action === "zoom-in" ? 1 / 1.2 : 1.2);
      else if (
        action === "focus-table" &&
        tables.some((table) => table.id === detail.tableId)
      ) {
        const id = detail.tableId;
        openContext('details');
        setSelectedElement((s) => ({ ...s, open: false, openDialogue: false }));
        if (detail.fieldId != null) { selectField(id, detail.fieldId, true); return; }
        if (locateTableInView(id)) return;
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
    inspectField: (tid, fid) => selectField(tid, fid, true),
    canFocus: currentResult && !!tableNode(selectedTable),
    focus: () => focusTable(selectedTable, selectedField),
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
      data-shell="engineering"
      aria-label="EDA 分析工作台"
      data-eda-model={modelId}
      data-eda-view={reading.location.diagramViewId}
      data-index-ready={indexed.ready ? "true" : undefined}
      data-index-phase={indexed.phase?.phase}
      data-reading-settled={settled ? "true" : undefined}
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
        <DiagramViewsBar views={diagramViews} active={activeView} onSelect={selectView} onCreate={() => setViewEditor(true)} onEdit={() => setViewEditor(activeView)} onCapture={capturePositions} onExport={() => { if (settled) setReadingExport(true); }} onCandidates={() => { setChecksOpen(false); reading.setReadingLayout(value => contextLayout(value, { active: 'details', visible: true })); setCandidatesOpen(v => !v); }} candidateCount={relationships.filter(isCandidateRelation).length} showCandidates={reading.location.showCandidates} onShowCandidates={reading.setPart('showCandidates')} busy={!settled} readOnly={layout.readOnly}/>
        <EdaToolbar
          workspaceControl={<ReadingWorkbenchBar reading={reading} workspaces={workspaces.workspaces} ready={settled} onSave={saveWorkspace} onLoad={loadWorkspace} onRemove={workspaces.remove}
            onContext={openContext} onDirection={direction => reading.setReadingLayout(value => ({ ...value, direction }))} error={workspaces.error || indexed.error}/>}
          onDisplay={() => openContext('display')} displayOpen={showInspector && context.active === 'display'}
          issues={structureIssues}
          checksOpen={checksOpen}
          onCheck={() => { reading.setReadingLayout(value => contextLayout(value, { active: 'details', visible: true })); setCandidatesOpen(false); setChecksOpen(value => !value); }}
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
          arrange={arrangeCurrent}
        />
        {viewError && <p role="alert" className="eda-warning">{viewError}</p>}
        {indexed.error && <p role="alert" className="eda-warning">{tr(indexed.error)} <button onClick={indexed.retry}>{tr('重建索引')}</button></p>}
        {reading.error && (
          <p role="alert" className="eda-warning">
            {tr(reading.error)}
          </p>
        )}
        {currentResult && result?.status === 'degraded' && <p role="status" className="eda-warning">{tr('布局仍有可读性冲突，已保留完整图；此结果不会缓存。')} {result.validity?.reasons.join(', ')}</p>}
        {currentResult && busy && <p role="status" className="eda-warning">{tr('已显示可用布局，正在继续优化。')} <button onClick={schematic.cancel}>{tr('取消')}</button></p>}
        {schematic.hasImprovement && <p role="status" className="eda-warning">{tr('优化已完成，当前查看位置保持不变。')} <button onClick={schematic.applyImprovement}>{tr('应用优化结果')}</button></p>}
        {currentResult && error && <p role="status" className="eda-warning">{tr(error)}</p>}
        <div
          className="eda-body"
          data-split-direction={reading.layout.direction}
          data-directory={showDirectory}
          data-inspector={showInspector}
        >
          {showDirectory && (
            <EdaDirectory
              title={title} viewName={activeView?.name}
              domains={domains}
              tables={tables}
              matches={matches}
              search={search}
              onSearch={setSearch}
              reading={reading}
              navigate={(...args) => {
                openContext('details');
                setChecksOpen(false);
                if (args[3]?.selectedField != null) {
                  setSearch('');
                  selectField(args[3].selectedTable, args[3].selectedField, true);
                  return;
                }
                if (args[3]?.selectedTable != null && locateTableInView(args[3].selectedTable)) return;
                navigate(...args);
              }}
            />
          )}
          <div
            ref={canvas}
            className="eda-canvas"
            data-minimap={settings.edaMinimap !== false}
            id="canvas"
            data-layout-optimizer={result?.optimization}
            data-layout-source={result?.cacheSource}
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
                selectedRelationshipIds={selectedRelationshipIds}
                scale={viewScale(view, viewport)}
                semanticZoom={settings.edaSemanticZoom !== false}
                displayOptions={normalizeDisplayOptions(settings)}
                dragPreview={dragPreview}
                onDragPreview={editableView && currentResult && !busy ? dragFrames.set : undefined}
                onNodeMove={editableView && currentResult && !busy ? moveTable : undefined}
                selectedNet={selectedNet}
                selectedRelation={selectedRelation}
                showCardinality={settings.edaCardinality !== false}
                view={view}
                onView={setView}
                onViewEnd={() => camera.flush()}
                onEdit={editTable}
                onExplain={setRelationPopup}
                onNode={(node) => {
                  openContext('details');
                  pendingFocus.current = null;
                  pendingRelation.current = null;
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
                  openContext('details');
                  pendingFocus.current = null;
                  pendingRelation.current = null;
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
                onField={(tid, fid) => { openContext('details'); selectField(tid, fid); }}
              />
            )}
            {!tables.length && (
              <div className="eda-state">
                当前模型尚无表。使用“新增”添加表，或在“更多”中导入模型。
              </div>
            )}
            {((busy && !currentResult) || (result && !currentResult && !error)) && (
              <div className="eda-state" role="status">
                正在整理关系…<button onClick={schematic.cancel}>取消</button>
              </div>
            )}
            {error && !currentResult && (
              <div className="eda-state eda-error" role="alert">
                {tr(error)}
                <button onClick={schematic.arrange}>重试</button>
                <button onClick={() => setTools("model")}>打开模型编辑</button>
              </div>
            )}
            {result && currentResult && !error && (
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
                  {result.projection.nets.some(net => net.selfReference) && <span style={{color:SELF_REFERENCE_COLOR}}>↶ {tr('表内关联')}</span>}
                </div>
                {settings.edaMinimap !== false && (
                  <EdaMinimap
                    result={result}
                    view={view}
                    viewport={viewport}
                    onView={setView}
                onViewEnd={() => camera.flush()}
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

              </>
            )}
          </div>
          {showInspector && <ReadingContextPane active={context.active} onSelect={openContext} onClose={() => { setChecksOpen(false); setCandidatesOpen(false); reading.setReadingLayout(value => contextLayout(value, { visible: false })); }}>
            {context.active === 'display' ? <EdaDisplaySettings embedded model={model} reading={reading} settings={settings} setSettings={setSettings} navigate={navigate}/>
              : context.active === 'references' ? <ObjectReferences model={model} index={indexed.ready ? indexed.index : null} tableId={selectedTable} fieldId={selectedField} onLocate={locateReference}/>
              : context.active === 'queries' ? <ReviewQueries model={model} index={indexed.ready ? indexed.index : null} queryId={reading.queryId} onSelect={reading.setQueryId} onNew={() => setQueryEditor(true)} onEdit={setQueryEditor} onLocate={locateQueryResult} readOnly={layout.readOnly}/>
              : checksOpen ? <StructureChecks onClose={() => setChecksOpen(false)} issues={structureIssues} onLocate={locateIssue} onEdit={editIssue} readOnly={layout.readOnly}/>
              : candidatesOpen ? <CandidateRelationships model={model} onClose={() => setCandidatesOpen(false)} onLocate={locateCandidate}/>
              : net || infoTable ? <EdaInspector selection={{ net, table: infoTable, field: fieldInfo, alternatives: fieldNets, selectedRelation }} tables={tables} relationships={relationships} actions={inspectorActions} readOnly={layout.readOnly}/>
              : <DocumentProperties model={model} title={title} activeView={activeView} result={currentResult ? result : null} onDisplay={() => openContext('display')} onCheck={() => { setChecksOpen(true); setCandidatesOpen(false); }}/>}
          </ReadingContextPane>}
        </div>
        <WorkbenchStatus status={!indexed.ready ? '正在更新对象索引…' : busy ? '正在整理布局…' : error ? '布局不可用' : '阅读已就绪'} busy={busy || !indexed.ready} error={error}
          selection={fieldInfo && infoTable ? `${infoTable.name}.${fieldInfo.name}` : infoTable?.name || net?.name || ''}
          count={`${visibleTableCount ?? tables.length} / ${tables.length} ${tr('表')} · ${relationships.length} ${tr('关系')}`}
          context={{ ...context, visible: showInspector }} showDirectory={showDirectory}
          onDirectory={() => reading.setReadingLayout(value => ({ ...value, directoryVisible: !showDirectory }))}
          onPanel={id => { if (showInspector && context.active === id) { setChecksOpen(false); setCandidatesOpen(false); reading.setReadingLayout(value => contextLayout(value, { visible: false })); } else openContext(id); }}
          hasSelection={selectedTable != null || selectedNet != null || selectedRelation != null} onClear={clearSelection}
          scale={viewScale(view, viewport)} onZoom={zoomView} onFit={fitView} onActualSize={() => setView(v => actualSizeView(v, viewport))}/>
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
      {viewEditor !== false && <DiagramViewEditor key={viewEditor?.id || 'new'} view={viewEditor === true ? null : viewEditor} model={model} onSave={saveView} onDelete={id => { setDiagramViews(views => views.filter(v => v.id !== id)); setViewEditor(false); selectView(''); }} onClose={() => setViewEditor(false)} readOnly={layout.readOnly}/>}
      {queryEditor !== false && <ReviewQueryEditor key={queryEditor?.id || 'new'} query={queryEditor === true ? null : queryEditor} groups={model.groups} onSave={saveQuery}
        onDelete={id => { if (layout.readOnly) return; setReviewQueries(values => values.filter(q => q.id !== id)); reading.setQueryId(''); setQueryEditor(false); }} onClose={() => setQueryEditor(false)} readOnly={layout.readOnly}/>}
      {readingExport && <ReadingExport model={model} title={title} diagramViews={diagramViews} onClose={() => setReadingExport(false)}/>}
      {relationPopup&&<RelationPopup request={relationPopup} tables={tables} relationships={relationships} onClose={()=>setRelationPopup(null)}/>}
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
            displayOptions: normalizeDisplayOptions(settings),
          }}
        />
      )}
    </section>
  );
}
