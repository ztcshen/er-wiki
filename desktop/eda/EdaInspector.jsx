import TableDetails from "./TableDetails";
import FieldDetails from "./FieldDetails";
import RelationDetails from "./RelationDetails";

export default function EdaInspector({
  selection,
  tables,
  relationships,
  actions,
  readOnly = false,
}) {
  const { net, table, field, alternatives, selectedRelation } = selection;
  // A field may highlight several nets, but its inspector remains field-focused.
  return (
    <aside className="eda-inspector" aria-label="对象详情">
      <div className="eda-inspector-heading">
        <strong>{field ? "字段详情" : net ? "关系详情" : "表详情"}</strong>
        <button
          className="eda-icon-button"
          aria-label="关闭详情"
          title="关闭详情"
          onClick={actions.clear}
        >
          ×
        </button>
      </div>
      {field && table ? (
        <FieldDetails
          field={field}
          table={table}
          tables={tables}
          relationships={relationships}
          actions={actions}
          readOnly={readOnly}
        />
      ) : net ? (
        <>
          {alternatives.length > 1 && (
            <details className="eda-network-options">
              <summary>此选择涉及 {alternatives.length} 个网络：</summary>
              {alternatives.map((item) => (
                <button
                  key={item.id}
                  onClick={() => actions.selectNet(item.id)}
                >
                  {item.code}
                </button>
              ))}
            </details>
          )}
          <RelationDetails
            net={net}
            selectedRelation={selectedRelation}
            tables={tables}
            actions={actions}
            readOnly={readOnly}
          />
        </>
      ) : table ? (
        <TableDetails
          table={table}
          tables={tables}
          relationships={relationships}
          actions={actions}
          readOnly={readOnly}
        />
      ) : null}
    </aside>
  );
}
