// Relative table placement is presentation metadata, never a database relation.
// ELK's interactive layering consumes pseudo positions; ELK still routes all edges.
export function placementHints(projection) {
  if (projection.level !== 'overview') return [];
  const tables = new Map(projection.nodes.filter(n => n.kind === 'table').map(n => [n.tableId, n]));
  return [...tables.values()].flatMap(node => {
    const hint = node.placement;
    if (!hint || typeof hint !== 'object') return [];
    const anchor = tables.get(hint.belowTableId), leftOf = tables.get(hint.leftOfTableId);
    if (!anchor || anchor.id === node.id || hint.leftOfTableId != null && (!leftOf || leftOf.id === node.id))
      throw new Error('Invalid relative table placement target');
    const gap = Number.isFinite(hint.gap) ? Math.max(65, Math.min(1200, hint.gap)) : 160;
    const offsetX = Number.isFinite(hint.offsetX) ? Math.max(-1200, Math.min(1200, hint.offsetX)) : 0;
    return [{ nodeId: node.id, anchorId: anchor.id, leftOfId: leftOf?.id, gap, offsetX }];
  });
}

export function placementPositions(layout, hints) {
  const positions = new Map(layout.children.map(n => [n.id, { x: n.x, y: n.y, width: n.width, height: n.height }]));
  const pending = new Map(hints.map(h => [h.nodeId, h])), visiting = new Set();
  const apply = id => {
    const hint = pending.get(id);
    if (!hint) return;
    if (visiting.has(id)) throw new Error('Cyclic relative table placement');
    visiting.add(id);
    apply(hint.anchorId);
    if (hint.leftOfId) apply(hint.leftOfId);
    const node = positions.get(id), anchor = positions.get(hint.anchorId);
    node.x = anchor.x + hint.offsetX;
    if (hint.leftOfId) node.x = Math.min(node.x, positions.get(hint.leftOfId).x - node.width - 110);
    node.y = anchor.y + anchor.height + hint.gap;
    visiting.delete(id);
    pending.delete(id);
  };
  for (const { nodeId } of hints) apply(nodeId);
  return positions;
}

export function satisfiesPlacement(layout, hints) {
  const nodes = new Map(layout.children.map(n => [n.id, n]));
  return hints.every(h => {
    const node = nodes.get(h.nodeId), anchor = nodes.get(h.anchorId), leftOf = nodes.get(h.leftOfId);
    // Pseudo positions choose the region; coordinates may compact to ELK's layers.
    return node.y >= anchor.y + anchor.height + 64 &&
      (!leftOf || node.x + node.width < leftOf.x);
  });
}

export async function arrangePlaced(projection, base, elk) {
  const hints = placementHints(projection);
  if (!hints.length) return [{ layout: base }];
  const positions = placementPositions(base, hints), candidates = [];
  for (const strategy of ['BRANDES_KOEPF', 'INTERACTIVE']) {
    const graph = { id: 'root', layoutOptions: { ...base.layoutOptions,
      'elk.layered.cycleBreaking.strategy': 'INTERACTIVE',
      'elk.layered.layering.strategy': 'INTERACTIVE',
      'elk.layered.crossingMinimization.semiInteractive': 'true',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': strategy,
      'elk.separateConnectedComponents': 'false',
    }, children: projection.nodes.map(n => {
      const pos = positions.get(n.id);
      return { id: n.id, x: pos.x, y: pos.y, width: n.width, height: n.height, ports: n.ports,
        layoutOptions: { 'elk.portConstraints': 'FIXED_POS', 'elk.position': `(${pos.x},${pos.y})` } };
    }), edges: projection.edges.map(e => ({ id: e.id, sources: e.sources, targets: e.targets,
      ...(e.labels ? { labels: e.labels } : {}) })) };
    const layout = await elk.layout(graph);
    if (satisfiesPlacement(layout, hints)) candidates.push({ layout, placement: strategy });
  }
  return candidates;
}
