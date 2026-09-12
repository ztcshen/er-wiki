import GroupControls from "@drawdb/components/EditorHeader/GroupControls";
import { tr } from "../i18n/renderer";

export default function EdaDirectory({
  domains,
  tables,
  matches,
  search,
  onSearch,
  reading,
  navigate,
}) {
  const { selectedTable, domainId } = reading.location;
  const names = new Map(tables.map((table) => [table.id, table]));
  return (
    <aside className="eda-directory" aria-label="模型目录">
      <div className="eda-directory-heading">
        <div>
          <strong>目录</strong>
          <span className="eda-directory-total">{tables.length}</span>
        </div>
        <div className="eda-directory-tools">
          <GroupControls fit={() => {}} />
        </div>
      </div>
      <label className="eda-search-box">
        <i className="bi bi-search" aria-hidden="true" />
        <span className="visually-hidden">定位表或字段</span>
        <input
          type="search"
          aria-label="搜索模型"
          placeholder="搜索表、字段、别名或枚举"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </label>
      <div className="eda-directory-scroll">
        {search ? (
          <>
            <div className="eda-search-summary">
              <span>{matches.length} 项匹配</span>
              <button onClick={() => onSearch("")}>清除搜索</button>
            </div>
            {!matches.length && (
              <p className="eda-empty-search">没有匹配结果</p>
            )}
            {matches.slice(0, 200).map(({ table, field }) => (
              <button
                key={`${table.id}:${field?.id ?? ""}`}
                onClick={() =>
                  navigate(
                    "column",
                    domains.find((d) => d.tableIds.includes(table.id))?.id ||
                      "",
                    table.id,
                    {
                      selectedTable: table.id,
                      selectedField: field?.id ?? null,
                    },
                  )
                }
              >
                <span>
                  {table.name}
                  {field ? `.${field.name}` : ""}
                </span>
                <small>
                  {(
                    field?.reviewChineseName ||
                    field?.comment ||
                    table.comment ||
                    ""
                  ).slice(0, 80)}
                </small>
              </button>
            ))}
            {matches.length > 200 && (
              <small>仅显示前 200 项，请缩小搜索范围。</small>
            )}
          </>
        ) : (
          domains.map((domain) => {
            const collapsed = reading.collapsedDomains.includes(domain.id);
            const name =
              domain.id === "__unassigned__" ? tr(domain.name) : domain.name;
            return (
              <section key={domain.id} className="eda-domain-section">
                <div
                  className="eda-domain-row"
                  style={{ "--domain-color": domain.color }}
                >
                  <button
                    className="eda-domain-toggle"
                    aria-expanded={!collapsed}
                    aria-label={`${collapsed ? "展开分组" : "折叠分组"} ${name}`}
                    onClick={() => reading.toggleDomain(domain.id)}
                  >
                    <i
                      className={`bi bi-chevron-${collapsed ? "right" : "down"}`}
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    className="eda-domain-heading"
                    aria-pressed={domainId === domain.id}
                    onClick={() => navigate("domain", domain.id)}
                  >
                    <span>{name}</span>
                    <small>{domain.tableIds.length}</small>
                  </button>
                </div>
                {!collapsed && (
                  <div className="eda-domain-members">
                    {domain.tableIds.map((id) => {
                      const table = names.get(id);
                      if (!table) return null;
                      return (
                        <button
                          key={id}
                          className="eda-table-link"
                          aria-current={
                            selectedTable === id ? "true" : undefined
                          }
                          onClick={() =>
                            navigate("table", domain.id, id, {
                              selectedTable: id,
                            })
                          }
                          title={table.comment}
                        >
                          <i className="bi bi-table" aria-hidden="true" />
                          <span>{table.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
      <footer className="eda-directory-footer">
        <span>本地模型 · 无云同步</span>
        <button onClick={reading.expandDomains} title="展开所有分组">
          全部展开
        </button>
      </footer>
    </aside>
  );
}
