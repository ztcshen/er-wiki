// ELK may decorate graph objects. Never share ports or labels between candidates.
export function elkGraph(projection, layoutOptions, positions) {
  return { id: 'root', layoutOptions: { ...layoutOptions },
    children: projection.nodes.map(n => {
      const pos = positions?.get(n.id);
      return { id: n.id, width: n.width, height: n.height, ports: structuredClone(n.ports),
        ...(pos ? { x: pos.x, y: pos.y } : {}),
        layoutOptions: { 'elk.portConstraints': 'FIXED_POS',
          ...(pos ? { 'elk.position': `(${pos.x},${pos.y})` } : {}) } };
    }),
    edges: projection.edges.map(e => ({ id: e.id, sources: [...e.sources], targets: [...e.targets],
      ...(e.labels ? { labels: e.labels.map(({ x, y, ...label }) => structuredClone(label)) } : {}) })),
  };
}
