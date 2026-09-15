// Coordinates and annotations share one four-sided port contract. Port IDs and
// field bindings are semantic identities; changing sides never rewrites them.
export const PORT_SIDES = {
  NORTH: { dx: 0, dy: -1, avoid: 1 }, SOUTH: { dx: 0, dy: 1, avoid: 2 },
  WEST: { dx: -1, dy: 0, avoid: 4 }, EAST: { dx: 1, dy: 0, avoid: 8 },
};
export const SELF_REFERENCE_CLEARANCE = 38;
export const isVerticalPort = side => side === 'NORTH' || side === 'SOUTH';

export function movePorts(projection, changes) {
  const next = structuredClone(projection), byId = new Map(changes.map(c => [c.id, c]));
  for (const node of next.nodes) {
    for (const port of node.ports) {
      const change = byId.get(port.id);
      if (!change) continue;
      if (!PORT_SIDES[change.side]) throw new Error('Invalid port side');
      // Keep the original row anchor so returning to a side restores field alignment.
      port.rowY ??= port.y;
      port.rowBadgeY ??= port.badgeY ?? port.y;
      port.layoutOptions['elk.port.side'] = change.side;
    }
    for (const port of node.ports) {
      const side = port.layoutOptions['elk.port.side'];
      if (!isVerticalPort(side)) {
        port.x = side === 'EAST' ? node.width : 0;
        port.y = port.rowY ?? port.y;
        if (port.rowBadgeY !== undefined) port.badgeY = port.rowBadgeY;
        delete port.badgeX;
      }
    }
    for (const side of ['NORTH', 'SOUTH']) {
      const groups = new Map();
      for (const port of node.ports.filter(p => p.layoutOptions['elk.port.side'] === side)) {
        const key = JSON.stringify(port.fieldIds || [port.rowBadgeY ?? port.rowY]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(port);
      }
      const rows = [...groups.values()].sort((a, b) => a[0].rowBadgeY - b[0].rowBadgeY || a[0].id.localeCompare(b[0].id));
      if (!rows.length) continue;
      const pitch = (node.width - 64) / Math.max(1, rows.length);
      if (pitch < 32) throw new Error('Too many field pins for a horizontal port rail');
      rows.forEach((ports, index) => {
        const center = 32 + pitch * (index + .5), y = side === 'NORTH' ? 0 : node.height;
        ports.sort((a, b) => a.id.localeCompare(b.id)).forEach((port, branch) => {
          const spread = Math.min(16, pitch / 3);
          port.x = center + (ports.length === 1 ? 0 : spread * (branch / (ports.length - 1) - .5));
          port.y = y; port.badgeX = center; port.badgeY = y;
        });
      });
    }
  }
  return next;
}

export function fourSideSuggestions(projection, layout) {
  const geometry = new Map(layout.children.map(n => [n.id, n]));
  const owners = new Map(projection.nodes.flatMap(n => n.ports.map(p => [p.id, n])));
  const adjacent = new Map();
  for (const edge of projection.edges) for (const a of edge.sources) for (const b of edge.targets) {
    if (!adjacent.has(a)) adjacent.set(a, []);
    if (!adjacent.has(b)) adjacent.set(b, []);
    adjacent.get(a).push(b); adjacent.get(b).push(a);
  }
  const suggestions = [];
  for (const n of projection.nodes.filter(n => n.kind === 'table')) for (const port of n.ports) {
    const peers = (adjacent.get(port.id) || []).map(id => owners.get(id)).filter(p => p && p.id !== n.id);
    if (!peers.length) continue; // Preserve separate pins on self references.
    const origin = geometry.get(n.id);
    const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const x = median(peers.map(p => geometry.get(p.id).x + p.width / 2));
    const y = median(peers.map(p => geometry.get(p.id).y + p.height / 2));
    const dx = x - origin.x - n.width / 2, dy = y - origin.y - n.height / 2;
    const vertical = Math.abs(dy) / (n.height / 2 + 48) > Math.abs(dx) / (n.width / 2 + 48);
    const side = vertical ? (dy > 0 ? 'SOUTH' : 'NORTH') : (dx > 0 ? 'EAST' : 'WEST');
    if (side !== port.layoutOptions['elk.port.side']) suggestions.push({ id: port.id, side });
  }
  return suggestions;
}
