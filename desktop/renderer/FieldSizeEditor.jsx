import { useEffect, useId, useRef, useState } from "react";
import { useDiagram, useLayout, useUndoRedo } from "@drawdb/hooks";
import { Action, ObjectType } from "@drawdb/data/constants";
import { resolveType } from "@drawdb/utils/customTypes";
import { parseFieldSize } from "./field-size.mjs";
import "./field-size.css";

export default function FieldSizeEditor({ table, field, inline = false }) {
  const { database, updateField } = useDiagram();
  const { layout } = useLayout();
  const { setUndoStack, setRedoStack } = useUndoRedo();
  const resolved = resolveType(database, field.type);
  const precision = !!resolved.hasPrecision;
  const [draft, setDraft] = useState(String(field.size ?? ""));
  const [error, setError] = useState(false);
  const committed = useRef(field.size),
    input = useRef(null);
  const errorId = useId();
  useEffect(() => {
    committed.current = field.size;
    setDraft(String(field.size ?? ""));
    setError(false);
  }, [field.id, field.type, field.size]);
  if (!resolved.isSized && !resolved.hasPrecision) return null;
  const message = precision
    ? "精度格式为 p 或 p,s；留空使用数据库默认值。"
    : "长度必须是非负整数，原值未改变。";
  const commit = () => {
    if (layout.readOnly) return false;
    const parsed = parseFieldSize(draft, precision);
    if (!parsed.valid) {
      setError(true);
      return false;
    }
    setError(false);
    setDraft(parsed.value);
    if (parsed.value === String(committed.current ?? "")) return true;
    const undo = { size: committed.current },
      redo = { size: parsed.value };
    committed.current = parsed.value;
    updateField(table.id, field.id, redo);
    setUndoStack((stack) => [
      ...stack,
      {
        action: Action.EDIT,
        element: ObjectType.TABLE,
        component: "field",
        tid: table.id,
        fid: field.id,
        undo,
        redo,
        message: `修改字段长度或精度 ${table.name}.${field.name}`,
      },
    ]);
    setRedoStack([]);
    return true;
  };
  return (
    <div
      className={"desktop-field-size" + (inline ? " is-inline" : "")}
      data-size-editor={field.name}
    >
      <label>
        <span>{precision ? "精度" : "长度"}</span>
        <input
          ref={input}
          type="text"
          inputMode={precision ? "text" : "numeric"}
          aria-label={
            (precision ? "字段精度 " : "字段长度 ") +
            table.name +
            "." +
            field.name
          }
          aria-invalid={error}
          aria-describedby={error ? errorId : undefined}
          title={
            precision
              ? "例如 10,2；回车或离开输入框提交，Esc 取消。"
              : "例如 256；回车或离开输入框提交，Esc 取消。"
          }
          placeholder={precision ? "10,2" : "256"}
          value={draft}
          disabled={layout.readOnly}
          maxLength={40}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(false);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setDraft(String(committed.current ?? ""));
              setError(false);
            } else if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              if (commit()) input.current?.blur();
            }
          }}
        />
      </label>
      {error && (
        <small id={errorId} role="alert">
          {message}
        </small>
      )}
    </div>
  );
}
