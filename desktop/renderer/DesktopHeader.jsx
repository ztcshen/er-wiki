import { useLayout, useSettings, useDiagram } from "@drawdb/hooks";
import { Dropdown, Toast } from "@douyinfe/semi-ui";
import { State } from "@drawdb/data/constants";
import { useEffect, useMemo, useState } from "react";
import DesktopModelSwitcher from "./DesktopModelSwitcher";
import DesktopPanels from "./DesktopPanels";
import CommandPalette from "./CommandPalette";
import {
  commandCatalogue,
  menuSections,
  commandEnabled,
} from "./command-catalogue.mjs";
import {
  openPanel,
  edaCommand,
  openCommandPalette,
  workspaceCommand,
} from "./commands";
import { dateText, tr } from "../i18n/renderer";
import "./workbench.css";

export { edaCommand } from "./commands";
// Keep the mature model/file tools; remove commands for the retired canvas.
export function configureEdaMenu(menu) {
  const keep = {
    edit: ["undo", "redo", "auto_connect_fk", "copy_as_image"],
    view: [
      "theme",
      "fullscreen",
      "reset_view",
      "zoom_in",
      "zoom_out",
      "dbml_view",
    ],
    settings: [
      "autosave",
      "show_timeline",
      "configure_custom_types",
      "language",
    ],
  };
  for (const [category, keys] of Object.entries(keep))
    for (const key of Object.keys(menu[category]))
      if (!keys.includes(key)) delete menu[category][key];
  for (const [key, action] of Object.entries({
    reset_view: "fit",
    zoom_in: "zoom-in",
    zoom_out: "zoom-out",
    dbml_view: "code",
  }))
    if (menu.view[key]) menu.view[key].function = () => edaCommand(action);
  if (menu.edit.copy_as_image)
    menu.edit.copy_as_image.function = () => edaCommand("copy-image");
  if (menu.settings.language)
    menu.settings.language.function = () => openPanel("settings");
}

export default function DesktopHeader({
  undo,
  redo,
  save,
  canUndo,
  canRedo,
  menu,
  onRename,
  title,
  lastSaved,
  saveState,
}) {
  const [moreOpen, setMoreOpen] = useState(false),
    [addOpen, setAddOpen] = useState(false);
  const { layout } = useLayout(),
    { settings } = useSettings(),
    { tables, relationships } = useDiagram();
  const model = useMemo(
    () => ({ tables, relationships }),
    [tables, relationships],
  );
  useEffect(() => {
    const close = () => {
      setMoreOpen(false);
      setAddOpen(false);
    };
    const names = [
      "erwiki-open-panel",
      "erwiki-eda-command",
      "erwiki-command",
      "erwiki-open-command-palette",
    ];
    names.forEach((name) => window.addEventListener(name, close));
    return () =>
      names.forEach((name) => window.removeEventListener(name, close));
  }, []);
  const commands = commandCatalogue.map((command) => ({
    ...command,
    disabled: !commandEnabled(command, {
      readOnly: layout.readOnly,
      tableCount: tables.length,
      canUndo,
      canRedo,
      saving: saveState === State.SAVING,
      menu,
    }),
  }));
  const find = (id) => commands.find((command) => command.id === id);
  const runCommand = async (command) => {
    if (!command || command.disabled) return;
    setMoreOpen(false);
    setAddOpen(false);
    if (command.target === "workspace") return workspaceCommand(command.action);
    if (command.target === "eda") return edaCommand(command.action);
    if (command.target === "panel") return openPanel(command.action);
    if (command.target === "upstream")
      return menu[command.action[0]][command.action[1]].function();
    const callbacks = { save, undo, redo, rename: onRename };
    return callbacks[command.action]?.();
  };
  const invoke = (id) =>
    runCommand(find(id))
      .then((result) => {
        if (result?.error) Toast.error(tr(result.error));
      })
      .catch((error) => Toast.error(tr(error.message)));
  const status = layout.readOnly
    ? "只读"
    : saveState === State.SAVING
      ? "保存中…"
      : saveState === State.ERROR
        ? "保存失败"
        : settings.autosave
          ? "自动保存"
          : "手动保存";
  const shortcut = navigator.platform.includes("Mac") ? "⌘" : "Ctrl+";
  return (
    <>
      <header className="desktop-header" aria-label="模型操作">
        <div className="desktop-header-identity">
          <span className="desktop-brand" title="ER Wiki · 本机工作区">
            <i className="bi bi-diagram-3" aria-hidden="true" />
          </span>
          <div className="desktop-project">
            <span className="desktop-wordmark">ER Wiki</span>
            <DesktopModelSwitcher />
          </div>
        </div>
        <button
          className="desktop-quick-search"
          aria-label="快速查找"
          onClick={openCommandPalette}
        >
          <i className="bi bi-search" aria-hidden="true" />
          <span>查找表或执行操作</span>
          <kbd>{shortcut}K</kbd>
        </button>
        <div className="desktop-header-actions">
          <span
            className={`desktop-save-status ${saveState === State.ERROR ? "is-error" : ""}`}
            title={`${status}；${lastSaved ? `上次模型保存：${dateText(lastSaved)}` : "尚无保存记录"}。图形阅读不改变保存时间。`}
          >
            <i aria-hidden="true" />
            <span>{status}</span>
          </span>
          <div className="desktop-history">
            <button
              className="desktop-icon-button"
              onClick={() => invoke("edit.undo")}
              disabled={find("edit.undo").disabled}
              aria-label="撤销"
              title={`撤销 · ${shortcut}Z`}
            >
              <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
            </button>
            <button
              className="desktop-icon-button"
              onClick={() => invoke("edit.redo")}
              disabled={find("edit.redo").disabled}
              aria-label="重做"
              title={`重做 · ${shortcut}Shift+Z`}
            >
              <i className="bi bi-arrow-clockwise" aria-hidden="true" />
            </button>
          </div>
          <Dropdown
            trigger="click"
            visible={addOpen}
            onVisibleChange={setAddOpen}
            position="bottomRight"
            render={
              <Dropdown.Menu>
                {["table.add", "relation.add"].map((id) => (
                  <Dropdown.Item
                    key={id}
                    disabled={find(id).disabled}
                    onClick={() => invoke(id)}
                  >
                    {tr(find(id).label)}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            }
          >
            <button className="desktop-add-button" disabled={layout.readOnly}>
              <i className="bi bi-plus-lg" aria-hidden="true" />
              新增
            </button>
          </Dropdown>
          <button
            className="desktop-save-button"
            onClick={() => invoke("model.save")}
            disabled={find("model.save").disabled}
            aria-label="保存模型"
            title={`保存模型 · ${shortcut}S`}
          >
            保存
          </button>
          <Dropdown
            trigger="click"
            visible={moreOpen}
            onVisibleChange={setMoreOpen}
            position="bottomRight"
            render={
              <Dropdown.Menu className="desktop-more-menu desktop-grouped-menu">
                {menuSections.map((section) => (
                  <div key={section.label} className="desktop-menu-section">
                    <div className="desktop-menu-heading" role="presentation">
                      {tr(section.label)}
                    </div>
                    {section.ids.map((id) => (
                      <Dropdown.Item
                        key={id}
                        disabled={find(id).disabled}
                        onClick={() => invoke(id)}
                      >
                        <i
                          className={`bi bi-${find(id).icon}`}
                          aria-hidden="true"
                        />
                        <span className="desktop-menu-label">
                          {tr(find(id).label)}
                        </span>
                      </Dropdown.Item>
                    ))}
                  </div>
                ))}
                <Dropdown.Divider />
                <Dropdown.Item onClick={() => openCommandPalette(">")}>
                  <i className="bi bi-command" aria-hidden="true" />
                  <span className="desktop-menu-label">所有操作…</span>
                  <kbd>{shortcut}K</kbd>
                </Dropdown.Item>
              </Dropdown.Menu>
            }
          >
            <button
              className="desktop-icon-button"
              aria-label="更多操作"
              title={`${title} · 更多操作`}
            >
              <i className="bi bi-three-dots" aria-hidden="true" />
            </button>
          </Dropdown>
        </div>
      </header>
      <DesktopPanels />
      <CommandPalette
        commands={commands}
        model={model}
        runCommand={runCommand}
      />
    </>
  );
}
