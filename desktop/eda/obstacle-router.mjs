// ELK supplies the skeleton; libavoid routes free-position candidates without
// forcing related tables back into successive layers. Both run in the worker.
import { PORT_SIDES, SELF_REFERENCE_CLEARANCE } from './ports.mjs';
import { cardinalityBadges } from './cardinality.mjs';
let loading;
export function loadObstacleRouter() {
  return loading ||= import('libavoid-js').then(async ({ AvoidLib }) => {
    const url = new URL('../../node_modules/libavoid-js/dist/libavoid.wasm', import.meta.url);
    // Let the Node entry resolve its own binary (including Windows drive paths);
    // the browser worker uses Vite's emitted, local WASM asset URL.
    await AvoidLib.load(typeof process !== 'undefined' && process.versions?.node ? undefined : url.href);
    return AvoidLib.getInstance();
  }).catch(error => { loading = null; throw error; });
}

export const rectanglesOverlap = (a, b, gap = 0) =>
  a.x < b.x + b.width + gap && a.x + a.width + gap > b.x &&
  a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;

function placeLabels(edges, nodes, badges) {
  const occupied = [...nodes, ...badges.map(b => ({ x: b.x - b.width / 2, y: b.y - b.height / 2, width: b.width, height: b.height }))];
  for (const edge of edges) for (const label of edge.labels || []) {
    const section = edge.sections[0], points = [section.startPoint, ...section.bendPoints, section.endPoint];
    const candidates = [];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (a.y === b.y && Math.abs(a.x - b.x) >= label.width + 40) {
        for (const ratio of [.5, .25, .75]) for (const side of [-1, 1]) candidates.push({
          x: a.x + (b.x - a.x) * ratio - label.width / 2,
          y: a.y + (side === -1 ? -label.height - 6 : 6),
        });
      }
      if (a.x === b.x && Math.abs(a.y - b.y) >= label.height + 40) {
        for (const ratio of [.5, .25, .75]) for (const side of [-1, 1]) candidates.push({
          x: a.x + (side === -1 ? -label.width - 6 : 6),
          y: a.y + (b.y - a.y) * ratio - label.height / 2,
        });
      }
    }
    const position = candidates.find(p => !occupied.some(n => rectanglesOverlap({ ...label, ...p }, n, 4)));
    if (!position) throw new Error('No clear corridor for relationship label');
    Object.assign(label, position); occupied.push(label);
  }
}

export function routeObstacles(Avoid, projection, seed) {
  const router = new Avoid.Router(Avoid.RouterFlag.OrthogonalRouting.value), endpoints = new Map();
  const layout = structuredClone(seed), meta = new Map(projection.nodes.map(n => [n.id, n]));
  router.setRoutingParameter(Avoid.RoutingParameter.shapeBufferDistance, 8);
  router.setRoutingParameter(Avoid.RoutingParameter.idealNudgingDistance, 6);
  router.setRoutingParameter(Avoid.RoutingParameter.crossingPenalty, 2000);
  router.setRoutingParameter(Avoid.RoutingParameter.segmentPenalty, 25);
  router.setRoutingOption(Avoid.RoutingOption.nudgeSharedPathsWithCommonEndPoint, false);
  const values = [], own = object => (values.push(object), object);
  try {
    for (const n of layout.children) {
      const point = own(new Avoid.Point(n.x + n.width / 2, n.y + n.height / 2));
      const rectangle = own(new Avoid.Rectangle(point, n.width, n.height));
      const shape = new Avoid.ShapeRef(router, rectangle);
      const ports = meta.get(n.id).ports;
      n.ports = structuredClone(ports);
      ports.forEach((port, index) => {
        const side = port.layoutOptions['elk.port.side'];
        if (!PORT_SIDES[side]) throw new Error('Invalid routing port side');
        const pin = new Avoid.ShapeConnectionPin(shape, index + 1, port.x / n.width, port.y / n.height, true, 0, PORT_SIDES[side].avoid);
        pin.setExclusive(false);
        endpoints.set(port.id, own(new Avoid.ConnEnd(shape, index + 1)));
      });
    }
    const connections = projection.edges.map(edge => {
      if (edge.sources.length !== 1 || edge.targets.length !== 1) throw new Error('Unsupported projected hyperedge');
      const connection = new Avoid.ConnRef(router, endpoints.get(edge.sources[0]), endpoints.get(edge.targets[0]));
      if (edge.kind === 'self') {
        const owner = projection.nodes.find(node => node.ports.some(port => port.id === edge.sources[0]));
        const position = layout.children.find(node => node.id === owner.id);
        const pins = [edge.sources[0], edge.targets[0]].map(id => owner.ports.find(port => port.id === id));
        const side = pins[0].layoutOptions['elk.port.side'];
        if (!['EAST', 'WEST'].includes(side) || pins[1].layoutOptions['elk.port.side'] !== side) throw new Error('Self reference requires same-side row ports');
        // libavoid still chooses the obstacle-free orthogonal route. Checkpoints
        // keep the local return rail clear of the table border and 1/N badges.
        const checkpoints = own(new Avoid.CheckpointVector());
        for (const pin of pins) {
          const point = own(new Avoid.Point(position.x + pin.x + (side === 'EAST' ? SELF_REFERENCE_CLEARANCE : -SELF_REFERENCE_CLEARANCE), position.y + pin.y));
          checkpoints.push_back(own(new Avoid.Checkpoint(point)));
        }
        connection.setRoutingCheckpoints(checkpoints);
      }
      return { edge, connection };
    });
    router.processTransaction();
    layout.edges = connections.map(({ edge, connection }) => {
      const route = connection.displayRoute(), routed = Array.from({ length: route.size() }, (_, i) => {
        const p = route.at(i), point = { x: p.x, y: p.y }; p.delete(); return point;
      });
      if (routed.length < 2) throw new Error('Obstacle router could not connect ports');
      const points = [];
      for (const point of routed) {
        const a = points.at(-2), b = points.at(-1);
        if (b && b.x === point.x && b.y === point.y) continue;
        if (a && (a.x === b.x && b.x === point.x || a.y === b.y && b.y === point.y)) points.pop();
        points.push({ ...point });
      }
      return { id: edge.id, sources: [...edge.sources], targets: [...edge.targets],
        sections: [{ id: edge.id + ':route', startPoint: points[0], bendPoints: points.slice(1, -1), endPoint: points.at(-1) }],
        ...(edge.labels ? { labels: structuredClone(edge.labels) } : {}),
      };
    });
    placeLabels(layout.edges, layout.children, cardinalityBadges({ layout, projection }));
    // Normalize nodes, wires and labels together; nothing is clipped at zero.
    const coords = [...layout.children.flatMap(n => [n, { x: n.x + n.width, y: n.y + n.height }]),
      ...layout.edges.flatMap(e => [...e.sections.flatMap(s => [s.startPoint, ...s.bendPoints, s.endPoint]),
        ...(e.labels || []).flatMap(l => [l, { x: l.x + l.width, y: l.y + l.height }])])];
    const dx = 40 - Math.min(...coords.map(p => p.x)), dy = 40 - Math.min(...coords.map(p => p.y));
    layout.width = Math.max(...coords.map(p => p.x)) + dx + 40;
    layout.height = Math.max(...coords.map(p => p.y)) + dy + 40;
    for (const n of layout.children) { n.x += dx; n.y += dy; }
    for (const e of layout.edges) for (const p of [...e.sections.flatMap(s => [s.startPoint, ...s.bendPoints, s.endPoint]), ...(e.labels || [])]) { p.x += dx; p.y += dy; }
    return layout;
  } finally {
    // Router owns its connectors, shapes and pins; value objects are ours.
    router.delete();
    for (const object of values.reverse()) object.delete();
  }
}
