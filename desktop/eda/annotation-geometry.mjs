// Annotation rectangles use SVG units and the same .1-unit contact tolerance as
// layout-quality. No font estimation or PCB-specific collision weights here.
export const boxOverlap = (a, b) => a.x < b.x + b.width - .1 && a.x + a.width > b.x + .1 &&
  a.y < b.y + b.height - .1 && a.y + a.height > b.y + .1;

export const segmentHitsBox = ({ a, b }, box) => Math.abs(a.y - b.y) < .01
  ? a.y > box.y + .1 && a.y < box.y + box.height - .1 && Math.max(a.x, b.x) > box.x + .1 && Math.min(a.x, b.x) < box.x + box.width - .1
  : a.x > box.x + .1 && a.x < box.x + box.width - .1 && Math.max(a.y, b.y) > box.y + .1 && Math.min(a.y, b.y) < box.y + box.height - .1;

export function boundingBox(boxes) {
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  return { x, y, width: Math.max(...boxes.map(b => b.x + b.width)) - x,
    height: Math.max(...boxes.map(b => b.y + b.height)) - y };
}

// A bounded uniform grid narrows obstacle queries. Oversized boxes use a small
// fallback list rather than allocating millions of grid cells on a long route.
export class AnnotationIndex {
  constructor(items = []) {
    this.cells = new Map(); this.large = []; this.items = items;
    for (const item of items) {
      const keys = this.keys(item);
      if (!keys) { this.large.push(item); continue; }
      for (const key of keys) {
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(item);
      }
    }
  }
  keys(box) {
    const left = Math.floor(box.x / 128), top = Math.floor(box.y / 128);
    const right = Math.floor((box.x + box.width) / 128), bottom = Math.floor((box.y + box.height) / 128);
    if (![left, top, right, bottom].every(Number.isFinite) || (right - left + 1) * (bottom - top + 1) > 256) return null;
    const keys = [];
    for (let x = left; x <= right; x++) for (let y = top; y <= bottom; y++) keys.push(`${x}:${y}`);
    return keys;
  }
  query(box) {
    const keys = this.keys(box);
    return keys ? new Set([...this.large, ...keys.flatMap(key => this.cells.get(key) || [])]) : this.items;
  }
}

// Move the entire text group beside an owned route segment. Candidates never
// rotate text; long captions stay readable and retain their relative alignment.
export function routeAnnotationCandidates(box, segments) {
  const candidates = [];
  for (const { a, b } of [...segments].sort((u, v) => v.length - u.length).slice(0, 24)) {
    const horizontal = Math.abs(a.y - b.y) < .01;
    const low = Math.min(horizontal ? a.x : a.y, horizontal ? b.x : b.y);
    const high = Math.max(horizontal ? a.x : a.y, horizontal ? b.x : b.y);
    const size = horizontal ? box.width : box.height;
    if (high - low < size + 8) continue;
    const nearest = Math.max(low + size / 2 + 4, Math.min(high - size / 2 - 4,
      horizontal ? box.x + box.width / 2 : box.y + box.height / 2));
    for (const center of [nearest, ...[.5, .25, .75, .1, .9].map(r => low + size / 2 + 4 + (high - low - size - 8) * r)]) {
      for (const gap of [6, 14, 26, 38]) for (const side of [-1, 1]) candidates.push(horizontal
        ? { x: center - box.width / 2, y: a.y + (side < 0 ? -box.height - gap : gap) }
        : { x: a.x + (side < 0 ? -box.width - gap : gap), y: center - box.height / 2 });
    }
  }
  return candidates;
}
