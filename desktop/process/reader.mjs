import { validView } from "../eda/reading-state.mjs";
export const MODES = ["er", "flow", "mixed"];
export const processReaderKey = (id) =>
  `erwiki.process.reader.v1.${encodeURIComponent(id)}`;
export function cleanProcessReader(value = {}) {
  return {
    mode: MODES.includes(value.mode) ? value.mode : "er",
    scenarioId:
      typeof value.scenarioId === "string"
        ? value.scenarioId.slice(0, 100)
        : "",
    activityId:
      typeof value.activityId === "string"
        ? value.activityId.slice(0, 100)
        : "",
    mixedScope: value.mixedScope === "all" ? "all" : "focused",
    views: Object.fromEntries(
      Object.entries(value.views || {})
        .filter(([key, view]) => key.length < 400 && validView(view))
        .slice(-80),
    ),
  };
}
export function processViewKey(reader) {
  return JSON.stringify([
    reader.mode,
    reader.scenarioId,
    reader.mixedScope,
    reader.mode === "mixed" && reader.mixedScope === "focused"
      ? reader.activityId
      : "",
  ]);
}
