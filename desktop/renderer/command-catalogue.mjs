import { searchModel } from "../eda/reading-state.mjs";

// One catalogue supplies the application menu and keyboard command palette.
// Targets are fixed capabilities, never arbitrary IPC channels or JavaScript.
export const commandCatalogue = [
  {
    id: "model.check",
    label: "结构检查",
    group: "阅读",
    icon: "check2-square",
    target: "eda",
    action: "check-model",
    keywords: "check validate schema review diagnostics",
  },
  {
    id: "model.new",
    label: "新建空白模型",
    group: "模型",
    icon: "file-earmark-plus",
    target: "workspace",
    action: "new",
    keywords: "new blank create",
  },
  {
    id: "model.clone",
    label: "复制当前模型",
    group: "模型",
    icon: "copy",
    target: "workspace",
    action: "clone",
    keywords: "duplicate copy",
  },
  {
    id: "model.rename",
    label: "重命名模型…",
    group: "模型",
    icon: "pencil",
    target: "callback",
    action: "rename",
    mutating: true,
    keywords: "rename title",
  },
  {
    id: "model.save",
    label: "保存模型",
    group: "模型",
    icon: "floppy",
    target: "workspace",
    action: "save",
    mutating: true,
    shortcut: "Mod+S",
    keywords: "save",
  },
  {
    id: "edit.undo",
    label: "撤销",
    group: "编辑",
    icon: "arrow-counterclockwise",
    target: "callback",
    action: "undo",
    mutating: true,
    shortcut: "Mod+Z",
    keywords: "undo",
  },
  {
    id: "edit.redo",
    label: "重做",
    group: "编辑",
    icon: "arrow-clockwise",
    target: "callback",
    action: "redo",
    mutating: true,
    shortcut: "Mod+Shift+Z",
    keywords: "redo",
  },
  {
    id: "table.add",
    label: "新增表",
    group: "编辑",
    icon: "table",
    target: "eda",
    action: "add-table",
    mutating: true,
    keywords: "new table create",
  },
  {
    id: "relation.add",
    label: "新增关系",
    group: "编辑",
    icon: "bezier2",
    target: "eda",
    action: "add-relationship",
    mutating: true,
    keywords: "new relationship reference foreign key",
  },
  {
    id: "import.json",
    label: "导入 JSON…",
    group: "导入与导出",
    icon: "box-arrow-in-down",
    target: "workspace",
    action: "import",
    keywords: "import json ddb",
  },
  {
    id: "import.sql",
    label: "导入 SQL…",
    group: "导入与导出",
    icon: "filetype-sql",
    target: "panel",
    action: "sql",
    keywords: "import sql ddl schema",
  },
  {
    id: "export.json",
    label: "导出 JSON…",
    group: "导入与导出",
    icon: "box-arrow-up",
    target: "workspace",
    action: "export",
    keywords: "export json model",
  },
  {
    id: "export.sql",
    label: "导出 SQL…",
    group: "导入与导出",
    icon: "filetype-sql",
    target: "workspace",
    action: "export-sql",
    keywords: "export sql ddl",
  },
  {
    id: "export.diagram",
    label: "导出 ER 图…",
    group: "导入与导出",
    icon: "image",
    target: "eda",
    action: "export-diagram",
    tables: true,
    keywords: "export svg png image diagram",
  },
  {
    id: "export.clipboard",
    label: "复制 PNG 到剪贴板",
    group: "导入与导出",
    icon: "clipboard",
    target: "eda",
    action: "copy-image",
    tables: true,
    keywords: "copy image png clipboard",
  },
  {
    id: "view.overview",
    label: "返回全部表总图",
    group: "阅读",
    icon: "grid",
    target: "eda",
    action: "overview",
    keywords: "all overview tables",
  },
  {
    id: "view.fit",
    label: "适应窗口",
    group: "阅读",
    icon: "arrows-fullscreen",
    target: "eda",
    action: "fit",
    tables: true,
    keywords: "fit view zoom",
  },
  {
    id: "view.arrange",
    label: "整理",
    group: "阅读",
    icon: "diagram-3",
    target: "eda",
    action: "arrange",
    tables: true,
    keywords: "arrange layout orthogonal",
  },
  {
    id: "view.directory",
    label: "显示或收起目录",
    group: "阅读",
    icon: "layout-sidebar",
    target: "eda",
    action: "toggle-directory",
    keywords: "sidebar directory toggle",
  },
  {
    id: "view.zoom-in",
    label: "放大",
    group: "阅读",
    icon: "zoom-in",
    target: "eda",
    action: "zoom-in",
    keywords: "zoom in",
  },
  {
    id: "view.zoom-out",
    label: "缩小",
    group: "阅读",
    icon: "zoom-out",
    target: "eda",
    action: "zoom-out",
    keywords: "zoom out",
  },
  {
    id: "view.fullscreen",
    label: "切换全屏",
    group: "阅读",
    icon: "fullscreen",
    target: "upstream",
    action: ["view", "fullscreen"],
    keywords: "fullscreen",
  },
  {
    id: "editor.model",
    label: "模型编辑…",
    group: "编辑",
    icon: "pencil-square",
    target: "eda",
    action: "model",
    keywords: "model editor indices tables relationships types",
  },
  {
    id: "editor.code",
    label: "DBML 编辑器",
    group: "编辑",
    icon: "code-square",
    target: "eda",
    action: "code",
    keywords: "dbml code view editor",
  },
  {
    id: "editor.connect",
    label: "自动连接外键",
    group: "高级",
    icon: "link-45deg",
    target: "upstream",
    action: ["edit", "auto_connect_fk"],
    mutating: true,
    keywords: "connect fk foreign keys",
  },
  {
    id: "editor.types",
    label: "配置自定义类型",
    group: "高级",
    icon: "braces",
    target: "upstream",
    action: ["settings", "configure_custom_types"],
    mutating: true,
    keywords: "custom types configure",
  },
  {
    id: "editor.history",
    label: "操作历史",
    group: "高级",
    icon: "clock-history",
    target: "upstream",
    action: ["settings", "show_timeline"],
    keywords: "history timeline",
  },
  {
    id: "app.backups",
    label: "备份与恢复…",
    group: "工作区",
    icon: "archive",
    target: "panel",
    action: "backups",
    keywords: "backup restore recovery",
  },
  {
    id: "app.settings",
    label: "设置…",
    group: "工作区",
    icon: "gear",
    target: "panel",
    action: "settings",
    shortcut: "Mod+,",
    keywords: "settings preferences language theme",
  },
  {
    id: "app.help",
    label: "使用说明",
    group: "工作区",
    icon: "question-circle",
    target: "panel",
    action: "help",
    keywords: "help guide documentation",
  },
];

export const menuSections = [
  { label: "模型", ids: ["model.new", "model.clone", "model.rename"] },
  {
    label: "导入与导出",
    ids: ["import.json", "import.sql", "export.json", "export.diagram"],
  },
  { label: "工作区", ids: ["app.backups", "app.settings", "app.help"] },
];

export function commandEnabled(command, state) {
  if (
    (command.mutating && state.readOnly) ||
    (command.tables && state.tableCount === 0)
  )
    return false;
  if (command.id === "edit.undo") return !!state.canUndo;
  if (command.id === "edit.redo") return !!state.canRedo;
  if (command.id === "model.save") return !state.saving;
  if (command.target === "upstream") {
    const entry = state.menu?.[command.action[0]]?.[command.action[1]];
    return typeof entry?.function === "function" && !entry.disabled;
  }
  return true;
}

export function paletteResults(
  model,
  commands,
  query,
  translate = (value) => value,
) {
  const commandOnly = query.trimStart().startsWith(">");
  const terms = (commandOnly ? query.trimStart().slice(1) : query)
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const matches = commands
    .filter((command) => {
      const text = [
        command.label,
        translate(command.label),
        command.keywords,
        command.id,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return terms.every((term) => text.includes(term));
    })
    .map((command) => ({
      kind: "command",
      id: command.id,
      label: translate(command.label),
      command,
    }));
  const tables = commandOnly
    ? []
    : terms.length
      ? searchModel(model, query)
      : model.tables.slice(0, 8).map((table) => ({ table, field: null }));
  return [
    ...matches,
    ...tables.map(({ table, field }) => ({
      kind: "table",
      id: `table:${JSON.stringify([table.id, field?.id ?? null])}`,
      label: field ? `${table.name}.${field.name}` : table.name,
      description:
        field?.reviewChineseName || field?.comment || table.comment || "",
      tableId: table.id,
      fieldId: field?.id ?? null,
    })),
  ].slice(0, 80);
}
