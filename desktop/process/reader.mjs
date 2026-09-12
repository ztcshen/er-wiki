import { validView } from "../eda/reading-state.mjs";
export const MODES = ["er", "flow"];
export const processReaderKey = (id) =>
  `erwiki.process.reader.v1.${encodeURIComponent(id)}`;
export const processViewKey = (reader) =>
  JSON.stringify(["flow", reader.scenarioId]);

export function cleanProcessReader(value = {}) {
  const views = new Map();
  for (const [key, view] of Object.entries(value.views || {})) {
    if (key.length >= 400 || !validView(view)) continue;
    try {
      const parts = JSON.parse(key);
      // Accept old flow keys, but never reuse coordinates of the removed view.
      if (
        !Array.isArray(parts) ||
        ![2, 4].includes(parts.length) ||
        parts[0] !== "flow" ||
        typeof parts[1] !== "string" ||
        parts[1].length > 100
      )
        continue;
      views.set(processViewKey({ scenarioId: parts[1] }), view);
    } catch {
      /* Ignore malformed reading preferences, not model content. */
    }
  }
  return {
    // Migration only: no runtime layout/rendering path for the old mode.
    mode:
      value.mode === "mixed"
        ? "flow"
        : MODES.includes(value.mode)
          ? value.mode
          : "er",
    scenarioId:
      typeof value.scenarioId === "string"
        ? value.scenarioId.slice(0, 100)
        : "",
    activityId:
      typeof value.activityId === "string"
        ? value.activityId.slice(0, 100)
        : "",
    views: Object.fromEntries([...views].slice(-80)),
  };
}
