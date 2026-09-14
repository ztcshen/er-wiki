import { useEffect, useState } from "react";
import "./review.css";

export default function EditableEnumRow({
  item,
  index,
  values,
  onCommit,
  readOnly,
  defaultValue,
}) {
  const [editing, setEditing] = useState(false),
    [value, setValue] = useState(String(item.value)),
    [label, setLabel] = useState(item.label || ""),
    [error, setError] = useState("");
  useEffect(() => {
    setValue(String(item.value));
    setLabel(item.label || "");
    setError("");
  }, [item.value, item.label]);
  const apply = () => {
    const code = value.trim();
    if (!code) {
      setError("请输入枚举值");
      return;
    }
    if (
      values.some((entry, i) => i !== index && String(entry.value) === code)
    ) {
      setError("该枚举值已存在");
      return;
    }
    if (code !== String(item.value) || label.trim() !== (item.label || ""))
      onCommit(
        values.map((entry, i) =>
          i === index ? { value: code, label: label.trim() } : entry,
        ),
      );
    setEditing(false);
    setError("");
  };
  const cancel = () => {
    setEditing(false);
    setError("");
    setValue(String(item.value));
    setLabel(item.label || "");
  };
  return (
    <tr className="editable-enum-row" data-enum-value={String(item.value)}>
      <td>
        {editing ? (
          <input
            aria-label="编辑枚举值"
            value={value}
            maxLength={128}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : (
          <>
            <code>{item.value}</code>
            {defaultValue === String(item.value) && (
              <small className="field-enum-default">默认</small>
            )}
          </>
        )}
      </td>
      <td>
        {editing ? (
          <>
            <input
              aria-label="编辑枚举含义"
              value={label}
              maxLength={80}
              onChange={(e) => setLabel(e.target.value)}
            />
            <small>修改后点应用，未应用的输入不会保存。</small>
          </>
        ) : (
          item.label || "—"
        )}
      </td>
      <td>
        {!readOnly &&
          (editing ? (
            <>
              <button type="button" onClick={apply}>
                应用
              </button>
              <button type="button" onClick={cancel}>
                取消
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                aria-label={`编辑枚举 ${item.value}`}
                onClick={() => setEditing(true)}
              >
                编辑
              </button>
              <button
                type="button"
                aria-label={`移除枚举 ${item.value}`}
                onClick={() => onCommit(values.filter((_, i) => i !== index))}
              >
                移除
              </button>
            </>
          ))}
        {error && <p role="alert">{error}</p>}
      </td>
    </tr>
  );
}
