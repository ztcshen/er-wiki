import { flushSync } from "react-dom";
import { importModel, exportModel } from "./model-file";
import { bindingIssues } from "../process/definition.mjs";
import { replacementRecord, commitReplacement } from "./replace-model.mjs";

export async function replaceWorkspace({
  current,
  db,
  action,
  targetId,
  json,
}) {
  const initial = current.current;
  if (initial.readOnly || !initial.localWritable)
    throw Object.assign(new Error("The current model must be a writable saved local model"), { code: 'MODEL_READ_ONLY' });
  const target = initial.snapshot.diagramId;
  if (action === "replace-json" && targetId !== target)
    throw Object.assign(new Error("Replacement target does not match the open model"), { code: 'TARGET_MISMATCH' });
  const file =
    action === "replace"
      ? await window.erDesktop.openModel("replace-json")
      : { json };
  if (!file) return false;
  if (
    typeof file.json !== "string" ||
    new TextEncoder().encode(file.json).length > 20 * 1024 * 1024
  )
    throw Object.assign(new Error("Model JSON must be no larger than 20 MB"), { code: 'MODEL_FILE_TOO_LARGE' });
  let data;
  try { data = JSON.parse(file.json); }
  catch (error) { throw Object.assign(error, { code: 'JSON_INVALID' }); }
  const incoming = importModel(file.json, "model.json");
  if (bindingIssues(incoming.processModel, incoming.tables).length)
    throw new Error(
      "Replacement process bindings reference missing tables or fields",
    );
  if (current.current.snapshot.diagramId !== target || current.current.readOnly)
    throw new Error("Replacement target does not match the open model");
  const content = current.current.getContentKey();
  if (
    action === "replace" &&
    !(await window.erDesktop.confirmReplace({
      name: current.current.snapshot.name,
      tables: incoming.tables.length,
      relations: incoming.references.length,
      groups: incoming.reviewGroups.length,
    }))
  )
    return false;
  const stillCurrent = () =>
    current.current.snapshot.diagramId === target &&
    current.current.getContentKey() === content &&
    !current.current.readOnly;
  if (!stillCurrent())
    throw new Error(
      "The current model changed during replacement; retry with the current document",
    );
  const host = document.getElementById("root");
  const wasInert = host?.inert;
  current.current.setReplacing(true);
  if (host) host.inert = true;
  try {
    // Reuse the existing backup capability, including any current unsaved edits.
    await window.erDesktop.createBackup({
      modelId: target,
      name: current.current.snapshot.name,
      json: exportModel(current.current.snapshot),
    });
    const expected = await db.diagrams
      .where("diagramId")
      .equals(target)
      .first();
    const next = replacementRecord(expected, incoming, data.title);
    await commitReplacement(db, expected, next, stillCurrent);
    flushSync(() => current.current.applyReplacement(next));
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    window.dispatchEvent(
      new CustomEvent("erwiki-eda-command", { detail: "model-replaced" }),
    );
    return true;
  } finally {
    current.current.setReplacing(false);
    if (host) host.inert = wasInert;
  }
}
