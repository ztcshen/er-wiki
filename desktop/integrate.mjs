import path from 'node:path';

function replaceOnce(code, anchor, replacement) {
  if (code.split(anchor).length !== 2) throw new Error(`Desktop integration anchor changed: ${anchor.slice(0, 70)}`);
  return code.replace(anchor, replacement);
}

export function integrateDesktop(here) {
  return (code, id) => {
    if (id.endsWith('/src/components/Workspace.jsx')) {
      code=code.replaceAll('数据模型工作台 | drawDB','ER Wiki');
      code = `import EdaWorkspace from ${JSON.stringify(path.join(here, 'eda/EdaWorkspace.jsx'))};\n` + code;
      const start='      <div\n        className="wiki-workspace-layout',end='        <Slot name="right-panel" />\n      </div>';
      if(code.split(start).length!==2||code.split(end).length!==2||code.indexOf(end)<code.indexOf(start))throw new Error('Desktop integration anchor changed: workspace body');
      code=replaceOnce(code,code.slice(code.indexOf(start),code.indexOf(end)+end.length),'      <EdaWorkspace key={loadedDiagramId || "blank"} modelId={loadedDiagramId || "blank"} ready={Boolean(isTemplate) || !loadedDiagramId || (diagramSource === "local" && viewOwnerIdRef.current === loadedDiagramId)} />');
      code=code.replaceAll('new Date().toLocaleString()', 'new Date().toISOString()').replaceAll('new Date(diagram.lastModified).toLocaleString()', 'new Date(diagram.lastModified).toISOString()');
      code = `import { useDesktopWorkspace } from ${JSON.stringify(path.join(here, 'renderer/useDesktopWorkspace.js'))};\n` + code;
      code = replaceOnce(code, '      setTitle("Untitled diagram");',
        '      setTitle("Untitled diagram");\n      setLastSaved("");\n      setSaveState(State.NONE);');
      return replaceOnce(code, '  const moveToCloud = useCallback(async () => {', `
  useDesktopWorkspace({
    save, navigate, lastSaved, autosave: settings.autosave,
    ready: Boolean(isTemplate) || !loadedDiagramId || (diagramSource === "local" && viewOwnerIdRef.current === loadedDiagramId),
    isDirty: () => modelContent !== savedModelContentRef.current,
    snapshot: { diagramId: isTemplate ? undefined : loadedDiagramId, name: title, database, tables,
      references: relationships, notes, areas, views, types, enums, reviewGroups,
      pan: latestViewRef.current.pan, zoom: latestViewRef.current.zoom },
  });

  const moveToCloud = useCallback(async () => {`);
    }
    if (id.endsWith('/src/components/EditorHeader/ControlPanel.jsx')) {
      code = replaceOnce(code, 'ignoreEventWhen: (e) => Boolean(e.target?.closest?.(".monaco-editor")),',
        'ignoreEventWhen: (e) => Boolean(e.target?.closest?.(".monaco-editor")) || (document.body.classList.contains("eda-reading") && !((e.metaKey || e.ctrlKey) && ["s", "z", "y", "o"].includes(e.key.toLowerCase()))),');
      code = `import DesktopHeader, { configureEdaMenu } from ${JSON.stringify(path.join(here, 'renderer/DesktopHeader.jsx'))};\n` + code;
      const headerStart='        {layout.header && (',headerEnd='        <ReviewToolbar arrange={autoArrangeTables} fit={fitToView} undo={undo} canUndo={undoStack.length>0} save={save} />';
      if(code.split(headerStart).length!==2||code.split(headerEnd).length!==2||code.indexOf(headerEnd)<code.indexOf(headerStart))throw new Error('Desktop integration anchor changed: header');
      code=replaceOnce(code,code.slice(code.indexOf(headerStart),code.indexOf(headerEnd)+headerEnd.length),
        '        <DesktopHeader undo={undo} redo={redo} save={save} canUndo={undoStack.length>0} canRedo={redoStack.length>0} menu={menu} translate={t} onRename={()=>setModal(MODAL.RENAME)} title={title} lastSaved={lastSaved} saveState={saveState}/>');
      code = replaceOnce(code, '  useHotkeys("mod+i", fileImport, EDITOR_HOTKEY);', '  configureEdaMenu(menu);\n  useHotkeys("mod+shift+z", redo, EDITOR_HOTKEY);\n  useHotkeys("mod+i", fileImport, EDITOR_HOTKEY);');
      code = replaceOnce(code, 'function: () => window.open("/editor", "_blank"),',
        'function: () => {}, disabled: true,');
      code = replaceOnce(code, '          save();\n          if (saveState === State.SAVED) navigate("/");',
        '          window.erDesktop.requestClose();');
      return code;
    }
    if (id.endsWith('/src/components/EditorHeader/Modal/Modal.jsx')) {
      return replaceOnce(code, 'window.open("/editor/templates/" + selectedTemplateId, "_blank");',
        'window.dispatchEvent(new CustomEvent("erwiki-navigate", { detail: "/editor/templates/" + selectedTemplateId }));');
    }
    if (id.endsWith('/src/components/EditorCanvas/CanvasEditorDialog.jsx')) {
      code=replaceOnce(code,'  children,','  children,\n  footerNote,');
      code=replaceOnce(code,'{layout.readOnly','{footerNote !== undefined ? footerNote : layout.readOnly');
      return code.replaceAll('当前浏览器', '桌面工作区');
    }
    if(id.endsWith('/src/context/DiagramContext.jsx')){
      return replaceOnce(code,'  };\n\n  const deleteTable =','    return data?.table?.id ?? newTable.id;\n  };\n\n  const deleteTable =');
    }
    if(id.endsWith('/src/components/EditorSidePanel/TablesTab/TableInfo.jsx')){
      code=replaceOnce(code,'          value={data.name}','          aria-label="表名称"\n          value={data.name}');
      return replaceOnce(code,'            onClick={() => deleteTable(data.id)}','            aria-label={`删除表 ${data.name}`}\n            onClick={() => deleteTable(data.id)}');
    }
    if(id.endsWith('/src/utils/fieldPresentation.js')){
      code=`import { resolveFieldLabel } from ${JSON.stringify(path.join(here,'renderer/field-labels.mjs'))};\n`+code;
      return replaceOnce(code,'export const chineseFieldName = (table, field) =>\n  fieldDisplayNames.tables[table]?.[field] ??\n  fieldDisplayNames.common[field] ??\n  "未命名";',
        'export const chineseFieldName = (table, field, data = { name: field }) =>\n  resolveFieldLabel(table, data, fieldDisplayNames.tables[table]?.[field] ?? fieldDisplayNames.common[field]);');
    }
    if(id.endsWith('/src/components/EditorSidePanel/TablesTab/TableField.jsx')){
      const anchor='chineseFieldName(table.name, data.name)';
      if(code.split(anchor).length!==3)throw new Error('Desktop field label anchor changed');
      return code.replaceAll(anchor,'chineseFieldName(table.name, data.name, data)');
    }
    if(id.endsWith('/src/components/EditorSidePanel/TablesTab/FieldDetails.jsx')){
      code=`import FieldCodeReference from ${JSON.stringify(path.join(here,'renderer/FieldCodeReference.jsx'))};\n`+code;
      code=`import DisplayNameEditor from ${JSON.stringify(path.join(here,'renderer/DisplayNameEditor.jsx'))};\n`+code;
      return replaceOnce(code,'      <div className="font-semibold">{t("default_value")}</div>',
        '      <DisplayNameEditor table={table} field={data}/><FieldCodeReference tableName={table.name} field={data}/>\n      <div className="font-semibold">{t("default_value")}</div>');
    }
    if(id.endsWith('/src/components/EditorCanvas/FieldEnumEditor.jsx')){
      return `import { tr as translateSource } from ${JSON.stringify(path.join(here,'i18n/renderer.js'))};\n`+code.replace('{definition.source}','{translateSource(definition.source)}');
    }
    if(id.endsWith('/src/components/EditorSidePanel/RelationshipsTab/RelationshipInfo.jsx')){
      return replaceOnce(code,'            onClick={() => deleteRelationship(data.id)}','            aria-label={`删除关系 ${data.name}`}\n            onClick={() => deleteRelationship(data.id)}');
    }
    return null;
  };
}
