// Reuse the workspace's complete hydration path for live document replacement.
import { uniqueAnchor, replaceOnce } from './anchors.mjs';

export function integrateReplacement(code) {
  const start = uniqueAnchor(code, "    const applyDiagramState = (diagram) => {");
  const end = uniqueAnchor(code, "    const resetEditorState = () => {");
  if (end < start)
    throw new Error("Replacement hydration anchor changed");
  let body = code
    .slice(start, end)
    .trimEnd()
    .replace(/^    /gm, "  ");
  if (!body.endsWith("  };")) throw new Error("Replacement hydration closing anchor changed");
  body = replaceOnce(body,
      "const applyDiagramState = (diagram) => {",
      "const applyDiagramState = useCallback((diagram) => {",
    );
  body = body.slice(0, -2) + "}, [setDatabase, setTables, setRelationships, setAreas, setReviewGroups, setGroupView, setNotes, setTransform, setTypes, setEnums, setViews, setSaveState]);";
  code = code.slice(0, start) + code.slice(end);
  code = replaceOnce(code,
    "  const load = useCallback(async () => {",
    body + "\n\n  const load = useCallback(async () => {",
  );
  code = replaceOnce(code,
    "  const savedModelContentRef = useRef(null);",
    "  const savedModelContentRef = useRef(null);\n  const replacementLockRef = useRef(false);",
  );
  code = replaceOnce(code,
    "  const save = useCallback(async () => {",
    "  const save = useCallback(async () => {\n    if (replacementLockRef.current) return;",
  );
  code = replaceOnce(code,
    "    isDirty: () => modelContent !== savedModelContentRef.current,",
    `    isDirty: () => modelContent !== savedModelContentRef.current,
    getContentKey: () => modelContent,
    localWritable: !isTemplate && diagramSource === "local" && !!loadedDiagramId,
    setReplacing: busy => { replacementLockRef.current = busy; },
    applyReplacement: diagram => {
      applyDiagramState(diagram);
      setUndoStack([]); setRedoStack([]);
    },`,
  );
  return code;
}
