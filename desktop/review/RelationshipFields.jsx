import "./review.css";
export default function RelationshipFields({
  tables,
  draft,
  onChange,
  readOnly,
}) {
  const source = tables.find((t) => t.id === draft.startTableId),
    target = tables.find((t) => t.id === draft.endTableId);
  const selectTable = (side, text) => {
    const table = tables.find((t) => String(t.id) === text);
    onChange({
      ...draft,
      [side + "TableId"]: table?.id ?? "",
      fields: draft.fields.map((pair) => ({ ...pair, [side + "FieldId"]: "" })),
    });
  };
  return (
    <div className="relationship-fields">
      <label>
        引用表
        <select
          aria-label="引用表"
          value={draft.startTableId}
          disabled={readOnly}
          onChange={(e) => selectTable("start", e.target.value)}
        >
          <option value="">请选择</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        目标表
        <select
          aria-label="目标表"
          value={draft.endTableId}
          disabled={readOnly}
          onChange={(e) => selectTable("end", e.target.value)}
        >
          <option value="">请选择</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {draft.fields.map((pair, index) => (
        <div className="relationship-pair" key={index} data-pair-index={index}>
          <select
            aria-label={`引用字段 ${index + 1}`}
            disabled={readOnly}
            value={pair.startFieldId}
            onChange={(event) => {
              const field = source?.fields.find(
                (f) => String(f.id) === event.target.value,
              );
              onChange({
                ...draft,
                fields: draft.fields.map((p, i) =>
                  i === index ? { ...p, startFieldId: field?.id ?? "" } : p,
                ),
              });
            }}
          >
            <option value="">请选择</option>
            {source?.fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <span>→</span>
          <select
            aria-label={`目标字段 ${index + 1}`}
            disabled={readOnly}
            value={pair.endFieldId}
            onChange={(event) => {
              const field = target?.fields.find(
                (f) => String(f.id) === event.target.value,
              );
              onChange({
                ...draft,
                fields: draft.fields.map((p, i) =>
                  i === index ? { ...p, endFieldId: field?.id ?? "" } : p,
                ),
              });
            }}
          >
            <option value="">请选择</option>
            {target?.fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={readOnly || draft.fields.length <= 1}
            aria-label={`移除字段对 ${index + 1}`}
            onClick={() =>
              onChange({
                ...draft,
                fields: draft.fields.filter((_, i) => i !== index),
              })
            }
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="relationship-add-pair"
        type="button"
        disabled={readOnly || !source || !target || draft.fields.length >= 50}
        onClick={() =>
          onChange({
            ...draft,
            fields: [...draft.fields, { startFieldId: "", endFieldId: "" }],
          })
        }
      >
        添加字段对
      </button>
    </div>
  );
}
