// Pinned-source integration must fail at build time, not emit a partial app.
export function uniqueAnchor(code, anchor) {
  const index = code.indexOf(anchor);
  if (!anchor || index < 0 || index !== code.lastIndexOf(anchor))
    throw new Error(`Desktop integration anchor changed: ${anchor.slice(0, 70)}`);
  return index;
}

export function replaceOnce(code, anchor, replacement) {
  uniqueAnchor(code, anchor);
  return code.replace(anchor, replacement);
}
