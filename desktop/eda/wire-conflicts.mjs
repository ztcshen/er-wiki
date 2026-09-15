const near = (a, b) => Math.abs(a - b) < .01;
const between = (value, a, b) => value >= Math.min(a, b) - .01 && value <= Math.max(a, b) + .01;

// Geometric coincidence alone is not a connection. Only explicitly shared
// endpoint identity (or a declared projection aggregate) permits endpoint contact.
export function wireConflicts(segments, layout, projection) {
  const geometry = new Map((layout.children || []).map(node => [node.id, node]));
  const ports = new Map((projection.nodes || []).flatMap(node => (node.ports || []).map(port => {
    const position = geometry.get(node.id);
    return [port.id, { x: (position?.x || 0) + port.x, y: (position?.y || 0) + port.y,
      identity: port.aggregateId || port.id }];
  })));
  const endpoints = new Map(projection.edges.map(edge => [edge.id, [...(edge.sources || []), ...(edge.targets || [])].map(id => ports.get(id)).filter(Boolean)]));
  const sharedEndpoint = (a, b, point) => (endpoints.get(a.id) || []).some(first =>
    near(first.x, point.x) && near(first.y, point.y) && (endpoints.get(b.id) || []).some(second =>
      first.identity === second.identity && near(second.x, point.x) && near(second.y, point.y)));
  const collinear = new Set(), contacts = new Set();
  for (let i = 0; i < segments.length; i++) for (let j = 0; j < i; j++) {
    const a = segments[i], b = segments[j];
    if (a.id === b.id || a.nets.some(net => b.nets.includes(net))) continue;
    const horizontalA = near(a.a.y, a.b.y), horizontalB = near(b.a.y, b.b.y);
    const key = [a.id, b.id].sort().join('|');
    let point;
    if (horizontalA === horizontalB) {
      const axis = horizontalA ? 'x' : 'y', lane = horizontalA ? 'y' : 'x';
      if (!near(a.a[lane], b.a[lane])) continue;
      const start = Math.max(Math.min(a.a[axis], a.b[axis]), Math.min(b.a[axis], b.b[axis]));
      const end = Math.min(Math.max(a.a[axis], a.b[axis]), Math.max(b.a[axis], b.b[axis]));
      if (end - start > .01) { collinear.add(`${key}:${lane}:${a.a[lane]}:${start}:${end}`); continue; }
      if (!near(start, end)) continue;
      point = { [axis]: start, [lane]: a.a[lane] };
    } else {
      const h = horizontalA ? a : b, v = horizontalA ? b : a;
      point = { x: v.a.x, y: h.a.y };
      if (!between(point.x, h.a.x, h.b.x) || !between(point.y, v.a.y, v.b.y)) continue;
      const innerH = !near(point.x, h.a.x) && !near(point.x, h.b.x);
      const innerV = !near(point.y, v.a.y) && !near(point.y, v.b.y);
      if (innerH && innerV) continue; // ordinary crossing, counted separately
    }
    if (!sharedEndpoint(a, b, point)) contacts.add(`${key}:${point.x.toFixed(2)}:${point.y.toFixed(2)}`);
  }
  return { collinearConflicts: collinear.size, illegalContacts: contacts.size };
}
