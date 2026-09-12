import { projectModel } from "../eda/model.mjs";
import { validateLayout, scoreLayout } from "../eda/metrics.mjs";
import { validateProcessModel } from "./definition.mjs";

export function projectProcess(model, scenario, options) {
  validateProcessModel({ version: 1, scenarios: [scenario] });
  const mixed = options.mode === "mixed",
    focused = mixed && options.scope !== "all";
  const stepIds = new Set(
    focused ? [options.activityId] : scenario.steps.map((step) => step.id),
  );
  if (focused)
    for (const flow of scenario.flows)
      if (flow.from === options.activityId || flow.to === options.activityId) {
        stepIds.add(flow.from);
        stepIds.add(flow.to);
      }
  const steps = scenario.steps.filter((step) => stepIds.has(step.id));
  const boundSteps = focused
    ? steps.filter((step) => step.id === options.activityId)
    : steps;
  const tableIds = new Set(
    mixed
      ? boundSteps.flatMap((step) =>
          step.bindings.map((binding) => binding.tableId),
        )
      : [],
  );
  const tables = model.tables
    .filter((table) => tableIds.has(table.id))
    .map((table) => ({
      ...table,
      hidden: false,
      reviewOverviewFields: [
        ...new Set(
          boundSteps
            .flatMap((step) =>
              step.bindings
                .filter((binding) => binding.tableId === table.id)
                .flatMap((binding) => binding.fieldIds),
            )
            .map((id) => table.fields.find((field) => field.id === id)?.name)
            .filter(Boolean),
        ),
      ],
    }));
  const relationList = model.relationships.filter(
    (relation) =>
      tableIds.has(relation.startTableId) && tableIds.has(relation.endTableId),
  );
  const data = projectModel(
    { ...model, tables, relationships: relationList },
    { level: "overview", labels: "off", bundle: true },
  );
  const projection = {
    ...data,
    tableNames: model.tables.map((table) => ({
      id: table.id,
      name: table.name,
    })),
    totalModelTables: model.tables.length,
    scenario,
    processMode: options.mode,
  };
  const port = (node, id, side, y) => {
    const result = {
      id: `${node.id}:process-port:${id}`,
      width: 0,
      height: 0,
      x: side === "EAST" ? node.width : 0,
      y,
      layoutOptions: { "elk.port.side": side },
    };
    node.ports.push(result);
    return result.id;
  };
  const stepNodes = new Map();
  for (const step of steps) {
    const width = mixed
      ? step.kind === "event"
        ? 176
        : step.kind === "decision"
          ? 224
          : 242
      : step.kind === "event"
        ? 120
        : step.kind === "decision"
          ? 176
          : 186;
    const height = step.kind === "event" ? 60 : 104;
    const node = {
      id: `process:${JSON.stringify(step.id)}`,
      kind: step.kind,
      stepId: step.id,
      title: step.name,
      comment: step.description || "",
      step,
      width,
      height,
      ports: [],
      color: "#0f766e",
      contextOnly: focused && step.id !== options.activityId,
    };
    node.input = port(node, "flow-in", "WEST", height / 2);
    node.output = port(node, "flow-out", "EAST", height / 2);
    projection.nodes.push(node);
    stepNodes.set(step.id, node);
  }
  for (const flow of scenario.flows)
    if (stepNodes.has(flow.from) && stepNodes.has(flow.to))
      projection.edges.push({
        id: `flow:${flow.id}`,
        kind: "process-flow",
        flowKind: flow.kind,
        from: flow.from,
        to: flow.to,
        label: flow.label || "",
        sources: [stepNodes.get(flow.from).output],
        targets: [stepNodes.get(flow.to).input],
        refs: [],
        netIds: [],
      });
  if (mixed)
    for (const step of boundSteps)
      for (const [i, binding] of step.bindings.entries()) {
        const table = projection.nodes.find(
            (node) => node.kind === "table" && node.tableId === binding.tableId,
          ),
          action = stepNodes.get(step.id);
        if (!table || !action) continue;
        const read = binding.access === "read";
        const indices = binding.fieldIds
          .map((id) => table.fields.findIndex((field) => field.id === id))
          .filter((index) => index >= 0);
        const y = indices.length
          ? 93 + (indices.reduce((a, b) => a + b, 0) / indices.length) * 30
          : 65;
        const tablePort = port(
          table,
          `${step.id}:${i}`,
          read ? "EAST" : "WEST",
          Math.min(table.height - 8, y),
        );
        const actionPort = port(
          action,
          `binding:${i}`,
          read ? "WEST" : "EAST",
          78,
        );
        projection.edges.push({
          id: `binding:${step.id}:${i}`,
          kind: "process-binding",
          binding,
          stepId: step.id,
          sources: [read ? tablePort : actionPort],
          targets: [read ? actionPort : tablePort],
          refs: [],
          netIds: [],
          label: binding.access.toUpperCase(),
        });
      }
  return projection;
}

export async function arrangeProcess(model, options, elk) {
  if (!elk) {
    const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
    elk = new ELK();
  }
  const projection = projectProcess(model, options.scenario, options);
  if (projection.nodes.length > 600 || projection.edges.length > 2000)
    throw new Error("Process view exceeds preview layout limits");
  const graph = {
    id: "process-root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.direction": "RIGHT",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.spacing.nodeNodeBetweenLayers":
        options.mode === "flow" ? "56" : "100",
      "elk.spacing.nodeNode": "60",
      "elk.spacing.edgeNode": "24",
      "elk.padding": "[top=44,left=44,bottom=44,right=44]",
    },
    children: projection.nodes.map((node) => ({
      id: node.id,
      width: node.width,
      height: node.height,
      ports: node.ports,
      layoutOptions: { "elk.portConstraints": "FIXED_POS" },
    })),
    edges: projection.edges.map((edge) => ({
      id: edge.id,
      sources: edge.sources,
      targets: edge.targets,
      ...(edge.label
        ? {
            labels: [
              {
                id: `${edge.id}:label`,
                text: edge.label,
                width: Math.min(200, Math.max(62, edge.label.length * 8 + 16)),
                height: 22,
              },
            ],
          }
        : {}),
    })),
  };
  const layout = await elk.layout(graph);
  validateLayout(layout, projection);
  return {
    projection,
    layout,
    metrics: scoreLayout(layout, projection),
    candidates: [],
  };
}
