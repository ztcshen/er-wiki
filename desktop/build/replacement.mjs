// Reuse the workspace's complete hydration path for live document replacement.
export function integrateReplacement(code) {
  const start = code.indexOf("    const applyDiagramState = (diagram) => {");
  const end = code.indexOf("    const resetEditorState = () => {", start);
  if (start < 0 || end < start)
    throw new Error("Replacement hydration anchor changed");
  const body = code
    .slice(start, end)
    .trimEnd()
    .replace(/^    /gm, "  ")
    .replace(
      "const applyDiagramState = (diagram) => {",
      "const applyDiagramState = useCallback((diagram) => {",
    )
    .replace(
      /\};$/,
      "}, [setDatabase, setTables, setRelationships, setAreas, setReviewGroups, setGroupView, setNotes, setTransform, setTypes, setEnums, setViews, setSaveState]);",
    );
  code = code.slice(0, start) + code.slice(end);
  code = code.replace(
    "  const load = useCallback(async () => {",
    body + "\n\n  const load = useCallback(async () => {",
  );
  code = code.replace(
    "  const savedModelContentRef = useRef(null);",
    "  const savedModelContentRef = useRef(null);\n  const replacementLockRef = useRef(false);",
  );
  code = code.replace(
    "  const save = useCallback(async () => {",
    "  const save = useCallback(async () => {\n    if (replacementLockRef.current) return;",
  );
  code = code.replace(
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
