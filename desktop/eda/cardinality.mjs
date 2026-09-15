import { conditionText } from './relation-condition.mjs';
import { PORT_SIDES } from './ports.mjs';
const cardinalities = new Map([
  ["one_to_one", { start: "1", end: "1", name: "一对一" }],
  ["one_to_many", { start: "1", end: "N", name: "一对多" }],
  ["many_to_one", { start: "N", end: "1", name: "多对一" }],
  ["many_to_many", { start: "N", end: "N", name: "多对多" }],
]);

// Existing cardinality stores maxima only. Never infer optionality or row counts.
export function cardinalityOf(relation) {
  return (
    cardinalities.get(relation?.cardinality) || {
      start: "?",
      end: "?",
      name: "未标注基数",
    }
  );
}

export function relationCaption(
  relation,
  tableName,
  translate = (value) => value,
) {
  const card = cardinalityOf(relation);
  const condition = conditionText(relation);
  return `${tableName(relation.startTableId)} (${card.start}) — (${card.end}) ${tableName(relation.endTableId)} · ${translate(card.name)}${condition ? ' · '+condition : ''}`;
}

export function matchesRelation(meta, netId, relationId, relationshipIds = null) {
  return relationId != null
    ? meta.refs.includes(relationId)
    : relationshipIds !== null ? meta.refs.some(id => relationshipIds.includes(id))
    : !!netId && meta.netIds.includes(netId);
}

export function nodeRelations(projection) {
  const owner = new Map(
    projection.nodes.flatMap((node) =>
      node.ports.map((port) => [port.id, node.id]),
    ),
  );
  const refs = new Map(projection.nodes.map((node) => [node.id, new Set()]));
  for (const edge of projection.edges)
    for (const port of [...edge.sources, ...edge.targets])
      for (const id of edge.refs) refs.get(owner.get(port))?.add(id);
  return new Map([...refs].map(([node, ids]) => [node, [...ids]]));
}

export function relationBounds(result, relationId) {
  const edges = result.projection.edges.filter((edge) =>
    edge.refs.includes(relationId),
  );
  if (!edges.length) return null;
  const ports = new Set(
    edges.flatMap((edge) => [...edge.sources, ...edge.targets]),
  );
  const nodeIds = new Set(
    result.projection.nodes
      .filter((node) => node.ports.some((port) => ports.has(port.id)))
      .map((node) => node.id),
  );
  const edgeIds = new Set(edges.map((edge) => edge.id));
  const points = (result.layout.edges || [])
    .filter((edge) => edgeIds.has(edge.id))
    .flatMap((edge) =>
      (edge.sections || []).flatMap((section) => [
        section.startPoint,
        ...(section.bendPoints || []),
        section.endPoint,
      ]),
    );
  for (const node of result.layout.children || [])
    if (nodeIds.has(node.id))
      points.push(
        { x: node.x, y: node.y },
        { x: node.x + node.width, y: node.y + node.height },
      );
  if (!points.length) return null;
  const x = Math.min(...points.map((point) => point.x)),
    y = Math.min(...points.map((point) => point.y));
  return {
    x,
    y,
    width: Math.max(...points.map((point) => point.x)) - x,
    height: Math.max(...points.map((point) => point.y)) - y,
  };
}

// Annotation geometry follows the existing fixed ports, not a second layout.
// Projection wires run from original END (referenced table) to original START
// (referencing table), even if ELK is arranged DOWN or a relationship is a self-FK.
export function cardinalityBadges(result, selectedRelation = null) {
  const relations = new Map(
    result.projection.nets.flatMap((net) =>
      net.members.map((relation) => [relation.id, relation]),
    ),
  );
  const geometry = new Map(
    (result.layout.children || []).map((node) => [node.id, node]),
  );
  const ports = new Map(
    result.projection.nodes.flatMap((node) =>
      node.ports.map((port) => [port.id, { node, port }]),
    ),
  );
  const groups = new Map();
  for (const edge of result.projection.edges) {
    if (!edge.refs.length) continue;
    for (const [portIds, role] of [
      [edge.sources, "end"],
      [edge.targets, "start"],
    ])
      for (const portId of portIds) {
        const endpoint = ports.get(portId);
        if (endpoint?.node.kind !== "table") continue;
        const { node, port } = endpoint,
          position = geometry.get(node.id);
        if (!position) continue;
        const side = port.layoutOptions["elk.port.side"];
        // Hidden-field/domain views can have several different field ports at the
        // same position. Summarize them once instead of stacking conflicting labels.
        const badgeY = port.badgeY ?? port.y, badgeX = port.badgeX ?? port.x;
        const normal = PORT_SIDES[side] || PORT_SIDES.WEST;
        const key = JSON.stringify([node.id, badgeX, badgeY, side]);
        if (!groups.has(key))
          groups.set(key, {
            id: key,
            tableId: node.tableId,
            side,
            x: position.x + badgeX,
            y: position.y + badgeY,
            normal,
            netIds: new Set(),
            entries: new Map(),
          });
        const group = groups.get(key);
        edge.netIds.forEach((id) => group.netIds.add(id));
        for (const id of edge.refs)
          if (relations.has(id))
            group.entries.set(id, {
              id,
              role,
              value: cardinalityOf(relations.get(id))[role],
            });
      }
  }
  return [...groups.values()].map((group) => {
    const entries = [...group.entries.values()];
    const focused = entries.find((entry) => entry.id === selectedRelation);
    const values = [
      ...new Set((focused ? [focused] : entries).map((entry) => entry.value)),
    ];
    // Reserve the largest label for this port, even while a member is hovered.
    const width = new Set(entries.map(entry => entry.value)).size > 1 ? 46 : 22;
    const height = 18, gap = 8;
    return {
      id: group.id,
      tableId: group.tableId,
      side: group.side,
      x: group.x + group.normal.dx * (width / 2 + gap),
      y: group.y + group.normal.dy * (height / 2 + gap),
      width,
      height,
      refs: entries.map((entry) => entry.id),
      netIds: [...group.netIds],
      value: values.length === 1 ? values[0] : "混合",
    };
  });
}

export function bundleBadges(result) {
  const meta = new Map(result.projection.edges.map((edge) => [edge.id, edge]));
  return (result.layout.edges || []).flatMap((edge) => {
    const info = meta.get(edge.id);
    if (!["bus", "domain"].includes(info?.kind)) return [];
    const segments = (edge.sections || []).flatMap((section) => {
      const points = [
        section.startPoint,
        ...(section.bendPoints || []),
        section.endPoint,
      ];
      return points.slice(1).map((b, i) => ({
        a: points[i],
        b,
        length: Math.abs(b.x - points[i].x) + Math.abs(b.y - points[i].y),
      }));
    });
    const segment = segments.sort((a, b) => b.length - a.length)[0];
    return segment
      ? [
          {
            ...info,
            count: info.refs.length,
            x: (segment.a.x + segment.b.x) / 2,
            y: (segment.a.y + segment.b.y) / 2 - 12,
          },
        ]
      : [];
  });
}
