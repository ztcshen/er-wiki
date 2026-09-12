import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { Toast } from "@douyinfe/semi-ui";
import CanvasEditorDialog from "@drawdb/components/EditorCanvas/CanvasEditorDialog";
import { paletteResults } from "./command-catalogue.mjs";
import { edaCommand } from "./commands";
import { tr, useLocale } from "../i18n/renderer";

export default function CommandPalette({ commands, model, runCommand }) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const { i18n } = useLocale();
  useEffect(() => {
    const show = (event) => {
      setQuery(event?.detail?.query || "");
      setOpen(true);
    };
    const keyboard = (event) => {
      if (event.isComposing || event.repeat || event.altKey) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        show();
      }
    };
    window.addEventListener("erwiki-open-command-palette", show);
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("erwiki-open-command-palette", show);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);
  const results = useMemo(
    () => paletteResults(model, commands, query, tr),
    [model, commands, query, i18n.language],
  );
  const execute = async (item) => {
    if (item.command?.disabled) return;
    setOpen(false);
    try {
      if (item.kind === "table")
        edaCommand("focus-table", {
          tableId: item.tableId,
          fieldId: item.fieldId,
        });
      else {
        const outcome = await runCommand(item.command);
        if (outcome?.error) Toast.error(tr(outcome.error));
      }
    } catch (error) {
      Toast.error(tr(error.message));
    }
  };
  return (
    <CanvasEditorDialog
      title="快速查找"
      visible={open}
      footerNote=""
      onClose={() => setOpen(false)}
    >
      {open && (
        <Command
          className="workbench-command"
          label={tr("搜索操作或表字段")}
          shouldFilter={false}
          loop
        >
          <div className="workbench-command-input">
            <i className="bi bi-search" aria-hidden="true" />
            <Command.Input
              autoFocus
              aria-label={tr("搜索操作或表字段")}
              placeholder={tr("输入操作、表名、字段或别名…")}
              value={query}
              onValueChange={setQuery}
            />
            <kbd>Esc</kbd>
          </div>
          <Command.List>
            <Command.Empty>没有匹配结果</Command.Empty>
            {(query.trim()
              ? [
                  ["command", "操作"],
                  ["table", "表与字段"],
                ]
              : [
                  ["table", "表与字段"],
                  ["command", "操作"],
                ]
            )
              .filter(([kind]) => results.some((item) => item.kind === kind))
              .map(([kind, title]) => (
                <Command.Group key={kind} heading={tr(title)}>
                  {results
                    .filter((item) => item.kind === kind)
                    .map((item) => (
                      <Command.Item
                        key={item.id}
                        value={item.id}
                        disabled={item.command?.disabled}
                        onSelect={() => execute(item)}
                      >
                        <i
                          className={`bi bi-${item.command?.icon || (item.fieldId === null ? "table" : "list-columns")}`}
                          aria-hidden="true"
                        />
                        <div>
                          <span>{item.label}</span>
                          {item.description && (
                            <small>{item.description}</small>
                          )}
                        </div>
                        {item.command?.shortcut && (
                          <kbd>
                            {item.command.shortcut.replace(
                              "Mod",
                              navigator.platform.includes("Mac") ? "⌘" : "Ctrl",
                            )}
                          </kbd>
                        )}
                        {item.command?.disabled && <small>当前不可用</small>}
                      </Command.Item>
                    ))}
                </Command.Group>
              ))}
          </Command.List>
          <footer>
            <span>↑ ↓ 选择 · Enter 打开 · Esc 关闭</span>
            <span>只搜索当前模型</span>
          </footer>
        </Command>
      )}
    </CanvasEditorDialog>
  );
}
