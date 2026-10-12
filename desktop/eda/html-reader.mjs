import { layoutSnapshot } from './layout-snapshot.mjs';
import { cardinalityOf } from './cardinality.mjs';
import { migrateModelDocument } from '../renderer/model-format.mjs';
import { layoutViewBox } from './camera.mjs';

const htmlText = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const readerJson = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const aborted = signal => { if (signal?.aborted) throw Object.assign(new Error('已取消阅读器导出'), { code: 'READING_EXPORT_CANCELLED' }); };

// Projection groups are a view of reviewGroups; export the maintained document
// contract and current shared records, not a nested second semantic model.
export function readingModelDocument(model, diagramViews = model?.diagramViews || []) {
  const { groups, metadata, ...current } = model;
  return migrateModelDocument({ ...metadata, ...current,
    tables: model.tables, relationships: model.relationships,
    reviewGroups: model.reviewGroups ?? metadata?.reviewGroups ?? groups ?? [], diagramViews,
  });
}

export function readerIdentity(encoded) {
  if (typeof encoded !== 'string') return undefined;
  try { const value = JSON.parse(encoded); return typeof value === 'string' || typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
  catch { return undefined; }
}

// One canonical model plus geometry snapshots and its existing renderer's SVG.
// The exported page never rebuilds another relationship/model interpretation.
export async function exportReadingHtml(model, {
  title = model?.title || 'ER Wiki', diagramViews = model?.diagramViews || [],
  language = 'zh', layout, sceneToSvg, signal, onProgress = () => {},
} = {}) {
  if (!Array.isArray(model?.tables) || !Array.isArray(model?.relationships) || !Array.isArray(diagramViews))
    throw new Error('无法导出无效的阅读模型');
  if (!layout) { const { arrangeSchematic } = await import('./layout.mjs'); layout = arrangeSchematic; }
  if (!sceneToSvg) {
    const { diagramSvg } = await import('./export-diagram.jsx');
    const style = getComputedStyle(document.querySelector('.eda-workspace') || document.documentElement);
    sceneToSvg = (result, view, props) => diagramSvg(result, view, style, props);
  }
  const candidateIds = new Set(model.relationships.filter(r => r.reviewEvidence?.status === 'candidate').map(r => r.id));
  const views = [], specs = [null, ...diagramViews];
  for (const [index, diagramView] of specs.entries()) {
    aborted(signal);
    onProgress({ completed: index, total: specs.length, name: diagramView?.name || (language === 'en' ? 'Complete diagram' : '完整图') });
    const result = await layout(model, { level: 'overview', labels: 'off', showCandidates: false, ...(diagramView ? { diagramView } : {}) });
    aborted(signal);
    if (!result?.layout || !Array.isArray(result.layout.children) || !Array.isArray(result.layout.edges) ||
        ![result.layout.width, result.layout.height].every(v => Number.isFinite(v) && v > 0 && v <= 1e8))
      throw new Error('阅读器布局无效');
    if (result.projection.edges.some(edge => edge.refs.some(id => candidateIds.has(id))))
      throw new Error('正式阅读图不能包含未确认的候选关联');
    const viewport = layoutViewBox(result.layout);
    const svg = await sceneToSvg(result, viewport, { showCardinality: true, semanticZoom: false, scale: 1 });
    if (typeof svg !== 'string' || !/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/.test(svg)) throw new Error('阅读器 SVG 无效');
    views.push({ viewId: diagramView?.id ?? null, svg, viewport, snapshot: layoutSnapshot(result), status: result.status || 'ready' });
  }
  aborted(signal);
  onProgress({ completed: specs.length, total: specs.length, name: '' });
  const cardinalities = Object.fromEntries(['one_to_one', 'one_to_many', 'many_to_one', 'many_to_many', 'unspecified'].map(value => [value, cardinalityOf({ cardinality: value })]));
  const payload = { version: 1, title: String(title), language: /^en(?:-|$)/i.test(language) ? 'en' : 'zh', model: readingModelDocument(model, diagramViews), views, cardinalities };
  const script = `(${readerBootstrap.toString()})(${readerIdentity.toString()});`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(script));
  const hash = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return `<!doctype html>
<html lang="${payload.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'">
<title>${htmlText(title)} · ER Wiki</title><style>${READER_CSS}</style></head>
<body><header><div><span class="brand">ER Wiki</span><h1 id="reader-title"></h1><p id="reader-counts"></p></div><button id="download-model" type="button"></button></header>
<div class="reader-shell"><aside><label for="reader-search" id="search-label"></label><input id="reader-search" type="search" autocomplete="off"><p id="search-count" role="status"></p><nav id="reader-directory"></nav></aside>
<main><section class="reader-canvas-card"><div class="reader-tools"><label for="reader-view" id="view-label"></label><select id="reader-view"></select><button id="zoom-out" type="button" aria-label="Zoom out">−</button><button id="zoom-in" type="button" aria-label="Zoom in">+</button><button id="fit-view" type="button"></button></div><p id="view-description"></p><div id="diagram-region" tabindex="0"><div id="reader-diagram"></div><svg id="reader-minimap" aria-label="Diagram overview" role="button" tabindex="0"></svg></div><p id="reader-status" role="status" aria-live="polite"></p></section>
<section id="reader-document" tabindex="-1"></section></main></div>
<script type="application/json" id="erwiki-data">${readerJson(payload)}</script><script>${script}</script></body></html>`;
}

// This function is serialized as a self-contained, hash-authorized offline script.
function readerBootstrap(identity) {
  'use strict';
  const data = JSON.parse(document.getElementById('erwiki-data').textContent);
  const model = data.model, english = data.language === 'en';
  const words = english ? {
    search: 'Search tables, fields and comments', view: 'Reading view', all: 'Complete diagram', fit: 'Fit diagram',
    download: 'Download model JSON', tables: 'tables', fields: 'fields', confirmed: 'confirmed relationships', candidates: 'candidates',
    noResults: 'No matching table or field', field: 'Field', type: 'Type', description: 'Description', constraint: 'Constraints',
    relations: 'Relationships and evidence', candidate: 'Candidate — not confirmed; omitted from the diagram',
    confirmedStatus: 'Confirmed in this model', notProvided: 'Not provided', locate: 'Show in diagram',
    missingView: 'This table is outside this view. Switched to the complete diagram.',
    hiddenField: 'This field is hidden in the diagram; its complete documentation is retained below.',
    purpose: 'Purpose', grain: 'What one row represents', authority: 'Source', enums: 'Enumerated values',
    guide: 'Select a table or field to read its documentation. Drag to pan; scroll to zoom.',
    degraded: 'This layout has readability conflicts. All model documentation is retained.',
    candidateDiagram: 'Candidate relationship: retained in the documentation, omitted from the confirmed diagram.',
    relationship: 'Relationship', matches: 'matches', cardinality: 'Declared cardinality', condition: 'Condition',
  } : {
    search: '搜索表、字段和注释', view: '阅读视图', all: '完整图', fit: '适应画面',
    download: '下载模型 JSON', tables: '张表', fields: '个字段', confirmed: '条已确认关联', candidates: '条候选关联',
    noResults: '没有匹配的表或字段', field: '字段', type: '类型', description: '说明', constraint: '约束',
    relations: '关联与依据', candidate: '候选关联 · 未确认；未绘入正式图', confirmedStatus: '本模型中的已确认关联',
    notProvided: '未提供', locate: '在图中定位', missingView: '此表不在当前视图，已切换到完整图。',
    hiddenField: '此字段在图中隐藏，下方文档仍保留完整说明。', purpose: '表的职责', grain: '一行代表什么', authority: '事实来源', enums: '枚举值',
    guide: '选择表或字段阅读说明。拖动平移，滚轮缩放。', degraded: '此布局仍有可读性冲突，完整模型文档仍保留。',
    candidateDiagram: '候选关联保留在文档中，未绘入已确认关系图。', relationship: '关联', matches: '项匹配', cardinality: '声明基数', condition: '条件',
  };
  const $ = id => document.getElementById(id);
  const element = (tag, text, cls) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = String(text ?? ''); if (cls) node.className = cls; return node; };
  const button = (text, action, cls) => { const node = element('button', text, cls); node.type = 'button'; node.addEventListener('click', action); return node; };
  const same = (a, b) => a === b;
  const keyOf = (node, attribute) => identity(node?.getAttribute(attribute));
  const tables = model.tables || [], relations = model.relationships || [];
  const tableFor = id => tables.find(t => same(t.id, id));
  const viewFor = view => (model.diagramViews || []).find(v => v.id === view.viewId);
  const isCandidate = r => r.reviewEvidence?.status === 'candidate';
  const pairs = r => r.fields?.length ? r.fields : [r];
  const parseIds = value => { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };
  let viewIndex = 0, svg, camera, full, selectedTable = null, selectedField = null, activeRelations = [];
  const cameras = new Map();
  $('reader-title').textContent = data.title;
  $('reader-counts').textContent = `${tables.length} ${words.tables} · ${tables.reduce((n, t) => n + (t.fields || []).length, 0)} ${words.fields} · ${relations.filter(r => !isCandidate(r)).length} ${words.confirmed} · ${relations.filter(isCandidate).length} ${words.candidates}`;
  $('search-label').textContent = words.search; $('reader-search').placeholder = words.search;
  $('view-label').textContent = words.view; $('fit-view').textContent = words.fit;
  $('download-model').textContent = words.download;
  $('reader-status').textContent = words.guide;
  data.views.forEach((view, index) => { const option = element('option', view.viewId === null ? words.all : viewFor(view)?.name || String(view.viewId)); option.value = String(index); $('reader-view').append(option); });
  const status = message => { $('reader-status').textContent = message; };
  const viewStatus = () => data.views[viewIndex].status === 'degraded' ? words.degraded : words.guide;

  // SVG is parsed as XML, whitelisted and imported as DOM. Model strings are
  // never HTML, and even a compromised SVG producer gains no executable nodes.
  function safeSvg(text) {
    const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') throw new Error('Invalid SVG');
    const allowed = new Set(['svg', 'g', 'path', 'rect', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'text', 'tspan', 'title', 'desc', 'defs', 'marker', 'pattern', 'clipPath', 'linearGradient', 'radialGradient', 'stop']);
    const root = parsed.documentElement;
    for (const node of [root, ...root.querySelectorAll('*')]) {
      if (!allowed.has(node.localName)) { node.remove(); continue; }
      for (const attribute of [...node.attributes]) {
        const name = attribute.name.toLowerCase(), value = attribute.value;
        if (name.startsWith('on') || name === 'style' || name === 'src' || name === 'srcset' ||
            (name.includes('href') && !/^#[a-zA-Z0-9_:.-]+$/.test(value)) ||
            ['fill', 'stroke', 'filter', 'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end', 'cursor'].includes(name) &&
            /(?:url\s*\(|javascript:|data:|https?:|\/\/)/i.test(value) && !/^url\(#[a-zA-Z0-9_:.-]+\)$/.test(value)) node.removeAttribute(attribute.name);
      }
    }
    root.removeAttribute('width'); root.removeAttribute('height'); root.setAttribute('role', 'img');
    root.setAttribute('aria-label', data.title); return document.importNode(root, true);
  }
  function world(event, node, box) {
    const rect = node.getBoundingClientRect(), scale = Math.max(box[2] / Math.max(1, rect.width), box[3] / Math.max(1, rect.height));
    return [box[0] + box[2] / 2 + (event.clientX - rect.left - rect.width / 2) * scale, box[1] + box[3] / 2 + (event.clientY - rect.top - rect.height / 2) * scale];
  }
  function updateCamera() {
    svg.setAttribute('viewBox', camera.join(' ')); cameras.set(viewIndex, [...camera]);
    const rect = $('reader-minimap').querySelector('[data-reader-camera]');
    if (rect) { ['x', 'y', 'width', 'height'].forEach((key, i) => rect.setAttribute(key, camera[i])); }
  }
  function zoom(factor, point = [camera[0] + camera[2] / 2, camera[1] + camera[3] / 2]) {
    const width = Math.max(Math.min(160, full[2]), Math.min(full[2] * 6, camera[2] * factor)), ratio = width / camera[2];
    camera = [point[0] - (point[0] - camera[0]) * ratio, point[1] - (point[1] - camera[1]) * ratio, width, camera[3] * ratio]; updateCamera();
  }
  function minimap() {
    const map = $('reader-minimap'); map.replaceChildren(); map.setAttribute('viewBox', full.join(' '));
    for (const node of data.views[viewIndex].snapshot.layout.children) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      ['x', 'y', 'width', 'height'].forEach(key => rect.setAttribute(key, node[key])); rect.setAttribute('fill', '#b9c7d6'); map.append(rect);
    }
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); rect.dataset.readerCamera = ''; rect.setAttribute('fill', '#2563eb22'); rect.setAttribute('stroke', '#2563eb'); rect.setAttribute('stroke-width', Math.max(2, full[2] / 150)); map.append(rect);
  }
  function renderView(index) {
    viewIndex = index; $('reader-view').value = String(index);
    const saved = data.views[index], definition = viewFor(saved);
    full = saved.viewport || [0, 0, Math.max(300, saved.snapshot.layout.width), Math.max(250, saved.snapshot.layout.height)]; camera = cameras.get(index) || [...full];
    svg = safeSvg(saved.svg);
    const layoutIds = new Set(saved.snapshot.layout.children.map(node => node.id));
    const tableKeys = new Map(tables.map(table => [`table:${JSON.stringify(table.id)}`, table.id]));
    for (const node of svg.querySelectorAll('[data-eda-node]')) {
      const nodeId = node.getAttribute('data-eda-node');
      if (!node.hasAttribute('data-table-key') && layoutIds.has(nodeId) && tableKeys.has(nodeId)) node.setAttribute('data-table-key', JSON.stringify(tableKeys.get(nodeId)));
    }
    $('reader-diagram').replaceChildren(svg); minimap(); updateCamera();
    $('view-description').textContent = definition?.description || '';
    status(saved.status === 'degraded' ? words.degraded : words.guide);
    let drag = null, moved = false;
    svg.addEventListener('pointerdown', event => { if (event.button !== 0) return; drag = { x: event.clientX, y: event.clientY, camera: [...camera], pointerId: event.pointerId }; moved = false; });
    svg.addEventListener('pointermove', event => {
      if (!drag) return; const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; if (!svg.hasPointerCapture(drag.pointerId)) svg.setPointerCapture(drag.pointerId); }
      if (!moved) return; const rect = svg.getBoundingClientRect(), scale = Math.max(drag.camera[2] / Math.max(1, rect.width), drag.camera[3] / Math.max(1, rect.height));
      camera = [drag.camera[0] - dx * scale, drag.camera[1] - dy * scale, drag.camera[2], drag.camera[3]]; updateCamera();
    });
    const endDrag = () => { drag = null; }; svg.addEventListener('pointerup', endDrag); svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('wheel', event => { event.preventDefault(); zoom(Math.exp(Math.max(-.45, Math.min(.45, event.deltaY * .0015))), world(event, svg, camera)); }, { passive: false });
    const activate = event => {
      if (event.type === 'click' && moved) { moved = false; return; }
      const field = event.target.closest('[data-eda-field]'), table = event.target.closest('[data-table-key]'), tableId = keyOf(table, 'data-table-key');
      if (tableId !== undefined) selectTable(tableId, keyOf(field, 'data-field-key') ?? null, false);
      else { const item = event.target.closest('[data-rel-ids]'); if (item) selectRelations(parseIds(item.getAttribute('data-rel-ids')), false); }
    };
    svg.addEventListener('click', activate); svg.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(event); } });
    highlight();
  }
  function tableNode(id) { return [...svg.querySelectorAll('[data-table-key]')].find(node => same(keyOf(node, 'data-table-key'), id)); }
  function focusTable(id, fieldId) {
    let node = tableNode(id), switched = false;
    if (!node && viewIndex !== 0) { renderView(0); node = tableNode(id); switched = true; }
    if (!node) return;
    const idValue = node.getAttribute('data-eda-node');
    const box = data.views[viewIndex].snapshot.layout.children.find(n => n.id === idValue);
    if (box) { const width = Math.max(650, box.width + 100), height = Math.max(380, box.height + 100); camera = [box.x - (width - box.width) / 2, box.y - (height - box.height) / 2, width, height]; updateCamera(); }
    const hidden = fieldId != null && ![...node.querySelectorAll('[data-eda-field]')].some(n => same(keyOf(n, 'data-field-key'), fieldId));
    status(hidden ? words.hiddenField : switched ? words.missingView : viewStatus());
  }
  function highlight() {
    for (const node of svg.querySelectorAll('[data-table-key]')) node.classList.toggle('reader-selected', selectedTable != null && same(keyOf(node, 'data-table-key'), selectedTable));
    for (const node of svg.querySelectorAll('[data-eda-field]')) node.classList.toggle('reader-field-selected', selectedField != null && same(keyOf(node, 'data-field-key'), selectedField) && same(keyOf(node.closest('[data-table-key]'), 'data-table-key'), selectedTable));
    for (const node of svg.querySelectorAll('[data-rel-ids]')) node.classList.toggle('reader-relation-selected', parseIds(node.getAttribute('data-rel-ids')).some(id => activeRelations.some(active => same(active, id))));
  }
  function relationList(ids, host) {
    host.append(element('h3', words.relations));
    const shown = relations.filter(r => ids.some(id => same(id, r.id)));
    if (!shown.length) { host.append(element('p', words.notProvided, 'muted')); return; }
    for (const relation of shown) {
      const article = element('article', undefined, 'reader-relation'); article.dataset.readerRelation = String(relation.id); article.dataset.readerRelationKey = JSON.stringify(relation.id);
      const source = tableFor(relation.startTableId), target = tableFor(relation.endTableId);
      article.append(element('h4', relation.name || `${source?.name || relation.startTableId} → ${target?.name || relation.endTableId}`));
      article.append(element('p', isCandidate(relation) ? words.candidate : words.confirmedStatus, isCandidate(relation) ? 'candidate-badge' : 'confirmed-badge'));
      const card = data.cardinalities[relation.cardinality] || data.cardinalities.unspecified;
      const cardinalityName = english ? ({ '一对一': 'One to one', '一对多': 'One to many', '多对一': 'Many to one', '多对多': 'Many to many', '未标注基数': 'Cardinality unspecified' }[card.name] || card.name) : card.name;
      article.append(element('p', `${words.cardinality}: ${card.start} : ${card.end} · ${cardinalityName}`));
      for (const pair of pairs(relation)) article.append(element('p', `${source?.name || relation.startTableId}.${source?.fields?.find(f => same(f.id, pair.startFieldId))?.name || pair.startFieldId} → ${target?.name || relation.endTableId}.${target?.fields?.find(f => same(f.id, pair.endFieldId))?.name || pair.endFieldId}`, 'code'));
      const evidence = relation.reviewEvidence;
      if (evidence?.kind) article.append(element('p', english ? ({ physical: 'Physical key declared in this model', logical: 'Logical relationship', inferred: 'Inferred relationship', unspecified: 'Relationship nature unspecified' }[evidence.kind] || evidence.kind) : ({ physical: '已声明物理外键', logical: '逻辑关联', inferred: '推断关联', unspecified: '性质未声明' }[evidence.kind] || evidence.kind)));
      article.append(element('p', evidence?.description || words.notProvided));
      if (evidence?.condition) article.append(element('p', `${words.condition}: ${evidence.condition.field} = ${String(evidence.condition.value ?? '')}`, 'code'));
      if (evidence?.source) article.append(element('p', typeof evidence.source === 'string' ? evidence.source : JSON.stringify(evidence.source), 'muted'));
      article.append(button(words.locate, () => selectRelations([relation.id], true))); host.append(article);
    }
  }
  function selectRelations(ids, locate) {
    activeRelations = ids;
    status(viewStatus());
    if (locate && ids.some(id => relations.some(r => same(r.id, id) && isCandidate(r)))) { status(words.candidateDiagram); }
    else if (locate) {
      const findWires = () => [...svg.querySelectorAll('[data-eda-wire]')].filter(node => parseIds(node.getAttribute('data-rel-ids')).some(id => ids.some(active => same(id, active))));
      let wires = findWires();
      if (!wires.length && viewIndex !== 0) { renderView(0); status(words.missingView); }
      wires = findWires();
      const edgeIds = new Set(wires.map(node => node.getAttribute('data-eda-wire'))), current = data.views[viewIndex].snapshot.layout;
      const points = current.edges.filter(edge => edgeIds.has(edge.id)).flatMap(edge => (edge.sections || []).flatMap(section => [section.startPoint, ...(section.bendPoints || []), section.endPoint]));
      const tableIds = relations.filter(r => ids.some(id => same(id, r.id))).flatMap(r => [r.startTableId, r.endTableId]);
      for (const tableId of tableIds) {
        const node = tableNode(tableId), box = current.children.find(n => n.id === node?.getAttribute('data-eda-node'));
        if (box) points.push({ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y + box.height });
      }
      if (points.length) {
        const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
        camera = [x - 60, y - 60, Math.max(300, Math.max(...points.map(p => p.x)) - x + 120), Math.max(250, Math.max(...points.map(p => p.y)) - y + 120)]; updateCamera();
      }
    }
    const host = $('reader-document'); host.replaceChildren(element('h2', words.relationship)); relationList(ids, host); highlight();
  }
  function selectTable(id, fieldId = null, locate = true) {
    const table = tableFor(id); if (!table) return;
    selectedTable = table.id; selectedField = fieldId; activeRelations = [];
    if (locate) focusTable(table.id, fieldId); else status(viewStatus());
    const host = $('reader-document'); host.replaceChildren(element('h2', table.reviewChineseName ? `${table.reviewChineseName} · ${table.name}` : table.name));
    host.append(element('p', table.comment || words.notProvided));
    const context = table.reviewContext;
    if (context) {
      const list = element('dl');
      for (const [label, value] of [[words.purpose, context.purpose], [words.grain, context.grain], [words.authority, context.authority?.summary]]) { if (value) list.append(element('dt', label), element('dd', value)); } host.append(list);
    }
    host.append(button(words.locate, () => { focusTable(table.id, selectedField); highlight(); }));
    const fields = element('table', undefined, 'reader-fields'), head = element('thead'), headings = element('tr');
    for (const label of [words.field, words.type, words.constraint, words.description]) headings.append(element('th', label)); head.append(headings); fields.append(head);
    const body = element('tbody');
    for (const field of table.fields || []) {
      const row = element('tr'); row.dataset.readerField = String(field.id); row.dataset.readerFieldKey = JSON.stringify(field.id); row.classList.toggle('selected', fieldId != null && same(field.id, fieldId));
      const name = element('td'); name.append(button(field.name, () => selectTable(table.id, field.id, true), 'reader-field-link'));
      const detail = element('td', field.comment || '');
      const values = Array.isArray(field.reviewEnumValues) ? field.reviewEnumValues.map(v => `${v.value} — ${v.label}`) : Array.isArray(field.values) ? field.values.map(String) : [];
      if (values.length) { const list = element('details'), summary = element('summary', words.enums); list.append(summary); for (const value of values) list.append(element('p', value, 'code')); detail.append(list); }
      row.append(name, element('td', field.type || ''), element('td', [field.primary && 'PK', field.unique && 'UNIQUE', field.notNull && 'NOT NULL'].filter(Boolean).join(' · ')), detail); body.append(row);
    }
    fields.append(body); host.append(fields);
    const touching = relations.filter(r => (same(r.startTableId, table.id) || same(r.endTableId, table.id)) && (fieldId == null || pairs(r).some(p => same(r.startTableId, table.id) && same(p.startFieldId, fieldId) || same(r.endTableId, table.id) && same(p.endFieldId, fieldId))));
    relationList(touching.map(r => r.id), host); highlight();
    if (fieldId != null) [...body.children].find(row => same(identity(row.dataset.readerFieldKey), fieldId))?.scrollIntoView({ block: 'nearest' });
  }
  function directory() {
    const query = $('reader-search').value.trim().toLocaleLowerCase(), nav = $('reader-directory'); nav.replaceChildren(); let count = 0;
    const searchable = field => [field.name, field.type, field.comment, field.reviewChineseName, ...(field.reviewEnumValues || []).flatMap(v => [v.value, v.label])].filter(v => v != null).join(' ').toLocaleLowerCase();
    for (const table of tables) {
      const fields = (table.fields || []).filter(field => query && searchable(field).includes(query));
      const matches = !query || [table.name, table.reviewChineseName, table.comment, table.reviewContext?.purpose].filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
      if (!matches && !fields.length) continue;
      const section = element('div', undefined, 'directory-table'); section.append(button(table.reviewChineseName ? `${table.reviewChineseName} · ${table.name}` : table.name, () => selectTable(table.id), 'directory-name')); count++;
      for (const field of fields) { section.append(button(`${field.name} · ${field.comment || field.type || ''}`, () => selectTable(table.id, field.id), 'directory-field')); count++; } nav.append(section);
    }
    if (!count) nav.append(element('p', words.noResults, 'muted')); $('search-count').textContent = `${count} ${words.matches}`;
  }
  $('reader-search').addEventListener('input', directory);
  $('reader-view').addEventListener('change', event => renderView(Number(event.target.value)));
  $('zoom-in').addEventListener('click', () => zoom(.8)); $('zoom-out').addEventListener('click', () => zoom(1.25));
  $('fit-view').addEventListener('click', () => { camera = [...full]; updateCamera(); });
  $('reader-minimap').addEventListener('click', event => { const point = world(event, $('reader-minimap'), full); camera = [point[0] - camera[2] / 2, point[1] - camera[3] / 2, camera[2], camera[3]]; updateCamera(); });
  $('reader-minimap').addEventListener('keydown', event => { if (event.key === 'Enter') { camera = [...full]; updateCamera(); } });
  $('download-model').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' })), link = element('a');
    link.href = url; link.download = `${String(data.title || 'ER Wiki').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100)}.drawdb.json`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  renderView(0); directory(); if (tables.length) selectTable(tables[0].id, null, false);
}

const READER_CSS = `
:root{color-scheme:light;--wiki-ink:#182437;--wiki-muted:#586a7e;--wiki-card:#fff;--wiki-line:#d8e2ed;--wiki-surface:#f4f7fb;--wiki-type-number:#436994;--wiki-grid:#e8edf4;--wiki-canvas:#f8fafc;--eda-active:#2563eb;--eda-field-active:#dbeafe;font-family:system-ui,-apple-system,sans-serif;color:var(--wiki-ink);background:#edf2f8}
*{box-sizing:border-box}body{margin:0}header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 28px;background:#fff;border-bottom:1px solid var(--wiki-line)}header h1{font-size:21px;margin:5px 0}header p{font-size:13px;margin:0;color:var(--wiki-muted)}.brand{font-size:11px;font-weight:750;letter-spacing:.12em;color:#2563eb}button,select,input{font:inherit}button{border:1px solid #cad7e5;background:white;color:#214469;border-radius:6px;padding:7px 10px;cursor:pointer}button:hover{background:#edf4ff}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #60a5fa;outline-offset:2px}.reader-shell{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:calc(100vh - 105px)}aside{padding:20px 15px;background:#f8fafc;border-right:1px solid var(--wiki-line)}aside label{font-size:12px;font-weight:650}input{width:100%;border:1px solid #bccbdd;border-radius:6px;padding:9px;margin-top:8px}#search-count{font-size:12px;color:var(--wiki-muted)}#reader-directory{max-height:calc(100vh - 225px);overflow:auto}.directory-table{padding:6px 0;border-bottom:1px solid var(--wiki-line)}.directory-name,.directory-field{display:block;width:100%;text-align:left;border:0;background:transparent;overflow-wrap:anywhere}.directory-name{font-weight:600;font-size:13px}.directory-field{font-size:12px;padding-left:20px;color:var(--wiki-muted)}main{padding:20px;min-width:0}.reader-canvas-card,#reader-document{background:#fff;border:1px solid var(--wiki-line);border-radius:10px;overflow:hidden;margin-bottom:20px}.reader-tools{padding:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.reader-tools label{font-size:12px;color:var(--wiki-muted)}select{padding:7px;border:1px solid #cad7e5;border-radius:6px;max-width:45%}#view-description{margin:0 14px 10px;color:var(--wiki-muted);font-size:13px}#view-description:empty{display:none}#diagram-region{position:relative;height:52vh;min-height:320px;overflow:hidden;background:var(--wiki-canvas);border-block:1px solid var(--wiki-line)}#reader-diagram,#reader-diagram>svg{width:100%;height:100%;display:block}#reader-diagram>svg{cursor:grab;touch-action:none}#reader-diagram>svg:active{cursor:grabbing}#reader-status{font-size:12px;color:var(--wiki-muted);padding:0 14px;min-height:18px}#reader-minimap{position:absolute;right:12px;bottom:12px;width:180px;height:105px;background:#ffffffec;border:1px solid #b5c6da;border-radius:6px;cursor:crosshair}#reader-document{padding:20px;overflow:auto}#reader-document h2{font-size:19px;margin:0 0 10px}#reader-document p{line-height:1.6;overflow-wrap:anywhere}#reader-document dl{display:grid;grid-template-columns:145px 1fr;gap:6px;font-size:13px}dd{margin:0}dt{color:var(--wiki-muted)}.reader-fields{width:100%;border-collapse:collapse;font-size:13px;margin:16px 0}.reader-fields th,.reader-fields td{text-align:left;border-bottom:1px solid var(--wiki-line);padding:9px;vertical-align:top;overflow-wrap:anywhere}.reader-fields th{color:var(--wiki-muted);font-weight:600;background:#f5f8fc}.reader-fields tr.selected{background:#eaf2ff}.reader-field-link{border:0;background:transparent;text-align:left;padding:0;color:#1d4ed8;font-family:ui-monospace,monospace}.reader-relation{padding:12px 15px;border:1px solid var(--wiki-line);border-radius:6px;margin:10px 0}.reader-relation h4{margin:0;font-size:14px}.reader-relation p{margin:6px 0;font-size:13px}.candidate-badge{display:inline-block;color:#92400e;background:#fffbeb;padding:2px 7px;border:1px solid #fcd34d;border-radius:4px}.confirmed-badge{color:#326556}.code{font-family:ui-monospace,monospace;font-size:12px}.muted{color:var(--wiki-muted)}.eda-node-title{font-size:14px;font-weight:600;fill:var(--wiki-ink)}.eda-small{font-size:11px;fill:var(--wiki-muted)}.eda-label-code{font-size:12px;font-weight:600;fill:var(--wiki-ink)}.eda-field-name{font-size:11px;fill:var(--wiki-ink)}.eda-field-type{font-size:10px;fill:var(--wiki-type-number)}.reader-selected>rect{stroke:#2563eb;stroke-width:3}.reader-field-selected>rect{fill:#dbeafe}.reader-relation-selected .eda-wire{stroke:#2563eb;stroke-width:3}.reader-relation-selected text{fill:#2563eb}.reader-fields details p{margin:3px 0}
@media(max-width:800px){header{padding:14px;align-items:flex-start}header h1{font-size:17px}header button{font-size:12px}.reader-shell{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid var(--wiki-line);padding:12px}#reader-directory{max-height:180px}main{padding:10px}#reader-document{padding:12px}.reader-fields{font-size:12px}.reader-fields th,.reader-fields td{padding:6px}#reader-minimap{width:120px;height:70px}}
@media print{header button,aside,.reader-tools,#reader-minimap{display:none}.reader-shell{display:block}main{padding:0}#diagram-region{height:500px}.reader-canvas-card,#reader-document{border:0;break-inside:avoid}}
`;
