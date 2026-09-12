import { accessLabel } from "./ProcessGlyphs";
export default function ProcessInspector({
  activity,
  tables,
  onShowER,
  onEditTable,
  selectedTable,
}) {
  return (
    <aside
      className="eda-inspector process-inspector"
      aria-label="流程动作详情"
    >
      <div className="eda-inspector-heading">
        <strong>动作与数据</strong>
        <span>显式配置</span>
      </div>
      {activity ? (
        <>
          <h3>{activity.name}</h3>
          <p>{activity.description || "此动作尚未补充说明。"}</p>
          <p className="process-muted">
            选择映射字段可切回 ER 并定位；读写箭头不是外键。
          </p>
          {activity.bindings.map((binding, index) => {
            const table = tables.find((table) => table.id === binding.tableId);
            return (
              <section
                className="process-binding-detail"
                key={index}
                data-access={binding.access}
                data-table-id={String(binding.tableId)}
                data-selected={selectedTable === binding.tableId}
              >
                <div>
                  <span
                    className={`process-access process-access-${binding.access}`}
                  >
                    {accessLabel(binding.access)}
                  </span>
                  <button
                    onClick={() => onShowER(binding.tableId)}
                    disabled={!table}
                  >
                    {table?.name || String(binding.tableId)}
                  </button>
                </div>
                <div className="process-field-links">
                  {binding.fieldIds.map((id) => {
                    const field = table?.fields.find(
                      (field) => field.id === id,
                    );
                    return (
                      <button
                        key={String(id)}
                        onClick={() => onShowER(binding.tableId, id)}
                        disabled={!field}
                      >
                        {field?.name || String(id)}
                      </button>
                    );
                  })}
                </div>
                {binding.state && (
                  <p className="process-state-change">
                    <code>
                      {table?.fields.find(
                        (field) => field.id === binding.state.fieldId,
                      )?.name || binding.state.fieldId}
                    </code>
                    <br />
                    {binding.state.from || "未创建"} → {binding.state.to}
                  </p>
                )}
                <button
                  className="process-edit-table"
                  disabled={!table}
                  onClick={() => onEditTable(binding.tableId)}
                >
                  编辑表
                </button>
              </section>
            );
          })}
          {!activity.bindings.length && (
            <p className="process-muted">这个事件没有表字段映射。</p>
          )}
        </>
      ) : (
        <p>选择一个业务动作查看数据影响。</p>
      )}
    </aside>
  );
}
