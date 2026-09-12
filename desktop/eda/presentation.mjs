// Presentation only: never changes nodes, ports, relationships or saved geometry.
export const isCompact = (scale) =>
  Number.isFinite(scale) && scale > 0 && scale < 0.55;
export function fitText(value, width, size = 11) {
  let units = 0,
    out = "";
  for (const char of String(value || "")) {
    units += /[\u3400-\u9fff]/.test(char) ? size : size * 0.58;
    if (units > width) return out + "…";
    out += char;
  }
  return out;
}
export function compactTitle(name, width, size) {
  const first = fitText(name, width, size);
  if (!first.endsWith("…")) return [first];
  const max = first.length - 1;
  const split = Math.max(
    String(name).lastIndexOf("_", max),
    String(name).lastIndexOf(" ", max),
  );
  const end = split >= max / 3 ? split + 1 : max;
  return [
    String(name).slice(0, end),
    fitText(String(name).slice(end), width, size),
  ];
}
export function tableRelationships(tableId, relationships) {
  return relationships.filter(
    (relation) =>
      relation.startTableId === tableId || relation.endTableId === tableId,
  );
}
export function relationColor(edge, relations, domains, fallback = "#8a9db0") {
  const colors = edge.refs.map((id) => {
    const relation = relations.get(id);
    const source = domains.get(relation?.startTableId),
      target = domains.get(relation?.endTableId);
    return source && target && source.id === target.id
      ? target.color
      : fallback;
  });
  return colors.length && colors.every((color) => color === colors[0])
    ? colors[0]
    : fallback;
}
