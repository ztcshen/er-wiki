import { validateLayout } from "../eda/metrics.mjs";
import { validateProcessModel } from "./definition.mjs";

// Process topology comes only from explicit flow definitions. Table bindings
// remain navigable metadata, never table nodes or data-access routing edges.
export function projectProcess(model, scenario) {
  validateProcessModel({ version: 1, scenarios: [scenario] });
  const nodes = scenario.steps.map((step) => {
    const width =
      step.kind === "event" ? 120 : step.kind === "decision" ? 176 : 186;
    const height = step.kind === "event" ? 60 : 104;
    const id = `process:${JSON.stringify(step.id)}`;
    const input = `${id}:in`,
      output = `${id}:out`;
    return {
      id,
      kind: step.kind,
      stepId: step.id,
      title: step.name,
      comment: step.description || "",
      step,
      width,
      height,
      input,
      output,
      ports: [
        {
          id: input,
          width: 0,
          height: 0,
          x: 0,
          y: height / 2,
          layoutOptions: { "elk.port.side": "WEST" },
        },
        {
          id: output,
          width: 0,
          height: 0,
          x: width,
          y: height / 2,
          layoutOptions: { "elk.port.side": "EAST" },
        },
      ],
    };
  });
  const index = new Map(nodes.map((node) => [node.stepId, node]));
  const edges = scenario.flows.map((flow) => ({
    id: `flow:${flow.id}`,
    kind: "process-flow",
    flowKind: flow.kind,
    from: flow.from,
    to: flow.to,
    label: flow.label || "",
    sources: [index.get(flow.from).output],
    targets: [index.get(flow.to).input],
  }));
  const knownTables = new Set(model.tables.map((table) => table.id));
  const mappedTableIds = [
    ...new Set(
      scenario.steps
        .flatMap((step) => step.bindings.map((binding) => binding.tableId))
        .filter((id) => knownTables.has(id)),
    ),
  ];
  return { nodes, edges, scenario, mappedTableIds };
}

export async function arrangeProcess(model, { scenario }, elk) {
  if (!elk) {
    const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
    elk = new ELK();
  }
  const projection = projectProcess(model, scenario);
  if (projection.nodes.length > 600 || projection.edges.length > 2000)
    throw new Error("Process view exceeds preview layout limits");
  const graph = {
    id: "process-root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.direction": "RIGHT",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.spacing.nodeNodeBetweenLayers": "56",
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
  return { projection, layout };
}
