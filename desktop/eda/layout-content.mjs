import { projectModel } from './model.mjs';

// Text, colors, types and enum explanations do not change fixed-size geometry.
// Selection of overview fields DOES change geometry and is captured via field IDs.
export function geometryKey(model, options) {
  const p = projectModel(model, options);
  return JSON.stringify({ nodes: p.nodes.map(n => [n.id, n.width, n.height, n.ports]),
    edges: p.edges.map(e => [e.id, e.sources, e.targets, e.netIds, e.refs]),
    level: options.level, labels: options.labels, bundle: options.bundle, expanded: options.expanded });
}

// Refresh presentation data without moving any node or changing a routed path.
export function refreshLayoutContent(result, model) {
  if (!result) return null;
  const tables = new Map(model.tables.map(t => [t.id, t]));
  const relations = new Map(model.relationships.map(r => [r.id, r]));
  const groups = new Map(model.groups.flatMap(g => g.tableIds.map(id => [id, g])));
  const nets = result.projection.nets.map(n => ({ ...n,
    name: `${tables.get(n.targetTableId)?.name}.${n.targetFields.map(id => tables.get(n.targetTableId)?.fields.find(f => f.id === id)?.name).join('+')}`,
    members: n.members.map(r => relations.get(r.id) || r) }));
  const netMap = new Map(nets.map(n => [n.id, n]));
  const nodes = result.projection.nodes.map(n => {
    if (n.kind === 'table') {
      const table = tables.get(n.tableId); if (!table) return n;
      return { ...n, title: table.name, comment: table.comment, totalFields: table.fields.length,
        fields: n.fields.map(f => table.fields.find(next => next.id === f.id) || f),
        color: groups.get(n.tableId)?.color || table.color || '#64748b',
        domainName: groups.get(n.tableId)?.name || '未分组 / 公共结构', domainUnassigned: !groups.has(n.tableId) };
    }
    if (n.kind === 'domain') {
      const group = model.groups.find(g => g.id === n.domainId);
      return group ? { ...n, title: group.name, color: group.color } : n;
    }
    const net = netMap.get(n.netId);
    return net ? { ...n, ...(n.kind === 'label' ? { subtitle: net.name } : {}),
      color: groups.get(net.targetTableId)?.color || '#64748b' } : n;
  });
  return { ...result, projection: { ...result.projection, nodes, nets, tableNames: model.tables.map(t=>({id:t.id,name:t.name})) } };
}
