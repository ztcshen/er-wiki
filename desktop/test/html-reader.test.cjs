const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const modulePromise = import('../eda/html-reader.mjs');
const modelPromise = import('../eda/model.mjs');

const fixture = () => ({ title: '阅读示例', tables: [
  { id: 0, name: 'orders', comment: '订单', fields: [{ id: 0, name: 'id', type: 'BIGINT', primary: true }, { id: 1, name: 'customer_id', type: 'BIGINT', comment: '客户编号' }] },
  { id: 1, name: 'customers', fields: [{ id: 0, name: 'id', type: 'BIGINT', primary: true }] },
], relationships: [{ id: 0, name: 'order_customer', startTableId: 0, startFieldId: 1, endTableId: 1, endFieldId: 0, cardinality: 'many_to_one' }], groups: [],
  diagramViews: [{ id: 'orders-view', name: '订单视图', depicts: [{ tableId: 0, x: 25, y: 40, hiddenFieldIds: [1] }] }],
});
async function resultFor(model) {
  const { projectModel } = await modelPromise;
  const projection = projectModel(model, { level: 'overview', labels: 'off', showCandidates: true });
  return { projection, layout: { width: 1000, height: 500,
    children: projection.nodes.map((node, i) => ({ ...node, x: 40 + i * 430, y: 40 })),
    edges: projection.edges.map(edge => ({ ...edge, sections: [] })) }, longCuts: [], metrics: { crossings: 0, overlaps: 0, length: 0, bends: 0 }, candidates: [], status: 'ready' };
}
const svg = () => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500"><g data-table-id="0" data-table-key="0" data-eda-node="table:0"><rect width="360" height="140"/></g><g data-rel-ids="[0]"><path class="eda-wire" d="M 400 70 L 470 70"/><text>1 : N</text></g></svg>';
const payloadOf = html => JSON.parse(html.match(/<script type="application\/json" id="erwiki-data">([\s\S]*?)<\/script>/)[1]);

test('single-file reader keeps one complete model and requests all persisted views from the existing render pipeline', async () => {
  const { exportReadingHtml } = await modulePromise, model = fixture();
  model.reviewQueries = [{ id: 'missing-docs', name: 'Missing documentation', target: 'fields', filters: { documentation: 'missing' } }];
  const before = JSON.stringify(model), result = await resultFor(model);
  const calls = [], renders = [], progress = [];
  const html = await exportReadingHtml(model, { title: 'Review', layout: async (value, options) => { assert.equal(value, model); calls.push(options); return result; },
    sceneToSvg: (value, view, props) => { assert.equal(value, result); renders.push({ view, props }); return svg(); }, onProgress: value => progress.push(value) });
  assert.equal(calls.length, 2); assert.equal(calls[0].diagramView, undefined); assert.equal(calls[1].diagramView, model.diagramViews[0]);
  assert(calls.every(options => options.level === 'overview' && options.showCandidates === false));
  assert(renders.every(render => render.props.showCardinality && render.props.semanticZoom === false));
  const data = payloadOf(html); assert.deepEqual(data.model.tables, model.tables); assert.deepEqual(data.model.relationships, model.relationships);
  assert.deepEqual(data.model.reviewGroups, model.groups); assert.equal(data.model.format, 'er-wiki'); assert.equal(data.model.schemaVersion, 4);
  assert.deepEqual(data.model.reviewQueries, model.reviewQueries);
  assert.equal(data.views.length, 2); assert.equal(data.views[1].viewId, 'orders-view');
  assert.equal(data.views[0].snapshot.layout.children.length, model.tables.length);
  assert(!Object.hasOwn(data.views[0], 'projection')); assert(!JSON.stringify(data.views[0].snapshot).includes('customer_id'));
  assert.equal(JSON.stringify(model), before); assert.equal(progress.at(-1).completed, 2);
  assert(!/<script\s+src=|<link\s[^>]*href=/i.test(html)); assert.match(html, /connect-src 'none'/);
  const runtime = html.match(/<script>([\s\S]*?)<\/script>/)[1], digest = crypto.createHash('sha256').update(runtime).digest('base64');
  assert(html.includes(`script-src 'sha256-${digest}'`));
});

test('model text cannot terminate JSON scripts, inject markup, or become executable HTML', async () => {
  const { exportReadingHtml, readerJson } = await modulePromise, model = fixture();
  const hostile = '</script><script>globalThis.readerPwned = true</script><img src="https://invalid.example">&\u2028\u2029';
  model.title = hostile; model.tables[0].fields[1].comment = hostile;
  const result = await resultFor(model), html = await exportReadingHtml(model, { layout: async () => result, sceneToSvg: svg });
  assert.equal(payloadOf(html).model.tables[0].fields[1].comment, hostile);
  assert(!html.includes('<script>globalThis.readerPwned')); assert(!html.includes('<img src="https://invalid.example">'));
  assert(!readerJson({ hostile }).includes('<')); assert.match(html, /&lt;\/script&gt;/);
});

test('candidate evidence is preserved without drawing it as a confirmed relationship', async () => {
  const { exportReadingHtml } = await modulePromise, model = fixture(), result = await resultFor(model);
  model.relationships.push({ ...model.relationships[0], id: 1, name: 'candidate', reviewEvidence: { status: 'candidate', kind: 'inferred', description: '字段名线索' } });
  const html = await exportReadingHtml(model, { layout: async () => result, sceneToSvg: svg });
  assert.equal(payloadOf(html).model.relationships[1].reviewEvidence.status, 'candidate');
  const unsafe = await resultFor(model);
  await assert.rejects(exportReadingHtml(model, { layout: async () => unsafe, sceneToSvg: svg }), /不能包含未确认/);
});

test('export cancellation stops before rendering and never requests another view', async () => {
  const { exportReadingHtml } = await modulePromise, model = fixture(), result = await resultFor(model), abort = new AbortController();
  let calls = 0, renders = 0;
  await assert.rejects(exportReadingHtml(model, { signal: abort.signal, layout: async () => { calls++; abort.abort(); return result; }, sceneToSvg: () => { renders++; return svg(); } }), error => error.code === 'READING_EXPORT_CANCELLED');
  assert.equal(calls, 1); assert.equal(renders, 0);
});

test('download model uses canonical format, current shared records and complete metadata without duplicating its semantic tree', async () => {
  const { exportReadingHtml, readingModelDocument } = await modulePromise, model = fixture();
  model.metadata = { format: 'er-wiki', schemaVersion: 2, tables: model.tables, relationships: model.relationships,
    reviewGroups: [{ id: 'all', name: '完整领域', color: '#112233', tableIds: [0, 1] }],
    notes: [{ id: 'source-note', content: 'Metadata retained' }], subjectAreas: [], types: [], enums: [], processModel: null };
  const current = readingModelDocument(model); assert.equal(current.tables, model.tables); assert.equal(current.relationships, model.relationships);
  assert.equal(current.reviewGroups, model.metadata.reviewGroups); assert(!Object.hasOwn(current, 'metadata')); assert(!Object.hasOwn(current, 'groups'));
  const result = await resultFor(model), html = await exportReadingHtml(model, { layout: async () => result, sceneToSvg: svg }), document = payloadOf(html).model;
  assert.deepEqual(document.reviewGroups, model.metadata.reviewGroups); assert.deepEqual(document.notes, model.metadata.notes);
  assert.equal(document.format, 'er-wiki'); assert.equal(document.schemaVersion, 4); assert(!Object.hasOwn(document, 'metadata'));
  assert.throws(() => readingModelDocument({ ...model, metadata: { ...model.metadata, schemaVersion: 999 } }), /newer ER Wiki/);
});

const typedFixture = () => { const model = { title: 'Typed identity', database: 'generic', tables: [
  { id: 0, name: 'number_table', fields: [{ id: 0, name: 'number_field', type: 'BIGINT', primary: true }, { id: '0', name: 'string_field', type: 'BIGINT' }] },
  { id: '0', name: 'string_table', fields: [{ id: 0, name: 'number_ref', type: 'BIGINT', primary: true }, { id: '0', name: 'string_ref', type: 'BIGINT' }] },
], relationships: [
  { id: 0, name: 'number_relation', startTableId: 0, startFieldId: '0', endTableId: '0', endFieldId: 0, cardinality: 'many_to_one' },
  { id: '0', name: 'string_relation', startTableId: 0, startFieldId: 0, endTableId: '0', endFieldId: '0', cardinality: 'one_to_one' },
], groups: [], diagramViews: [] };
  model.tables = model.tables.map(table => ({ x: 0, y: 0, color: '#123456', comment: '', indices: [], ...table,
    fields: table.fields.map(field => ({ primary: false, unique: false, notNull: !!field.primary, increment: false, default: '', check: '', comment: '', ...field })) }));
  model.relationships = model.relationships.map(relation => ({ updateConstraint: 'No action', deleteConstraint: 'No action', ...relation }));
  return model;
};

test('numeric and string identities coexist through complete model serialization', async () => {
  const { exportReadingHtml } = await modulePromise, model = typedFixture(), result = await resultFor(model);
  const html = await exportReadingHtml(model, { layout: async () => result, sceneToSvg: svg }), actual = payloadOf(html).model;
  assert.deepEqual(actual.tables.map(t => t.id), [0, '0']); assert.deepEqual(actual.tables[0].fields.map(f => f.id), [0, '0']);
  assert.deepEqual(actual.relationships.map(r => r.id), [0, '0']);
  assert.equal(actual.relationships[0].startFieldId, '0'); assert.equal(actual.relationships[1].startFieldId, 0);
});

test('export fits saved geometry far from the origin without relocating nodes or changing the model', async () => {
  const { exportReadingHtml } = await modulePromise, model = fixture(), result = await resultFor(model);
  result.layout.children = result.layout.children.map(node => ({ ...node, x: node.x + 10000, y: node.y + 8000 }));
  result.layout.width = 12000; result.layout.height = 11000;
  const before = JSON.stringify(result), modelBefore = JSON.stringify(model), rendered = [];
  const html = await exportReadingHtml(model, { layout: async () => result, sceneToSvg: (_result, view) => { rendered.push(view); return svg(); } });
  const data = payloadOf(html), viewport = data.views[0].viewport;
  // Endpoint badges can extend beyond the saved table boxes. They still belong
  // to this distant content region, rather than forcing the camera to origin.
  assert(viewport[0] >= 9900 && viewport[1] >= 7900); assert(viewport[2] < 2000 && viewport[3] < 1000);
  assert.deepEqual(rendered[0], viewport); assert.deepEqual(data.views[0].snapshot.layout.children.map(node => [node.x, node.y]), result.layout.children.map(node => [node.x, node.y]));
  assert.equal(JSON.stringify(result), before); assert.equal(JSON.stringify(model), modelBefore);
});

let chromium;
try { ({ chromium } = require('playwright')); } catch { /* Optional offline-browser verification dependency. */ }
test('offline reader locates typed table/field/relation identities and downloads a canonical round-trip model', {
  skip: !chromium && 'Run with Playwright available for offline browser verification',
}, async () => {
  const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), { pathToFileURL } = require('node:url');
  const { exportReadingHtml } = await modulePromise, { requireValidModelDocument } = await import('../review/model-contract.mjs');
  const model = typedFixture();
  model.tables[0].fields.push({ id: 'note', name: 'hidden_note', type: 'BIGINT', primary: false, unique: false, notNull: false, increment: false, default: '', check: '', comment: '' });
  model.metadata = { format: 'er-wiki', schemaVersion: 2, tables: model.tables, relationships: model.relationships,
    reviewGroups: [{ id: 'all', name: 'Shared group', color: '#123456', tableIds: [0, '0'] }], notes: [], subjectAreas: [], types: [], enums: [], processModel: null };
  const result = await resultFor(model);
  result.layout.edges = result.layout.edges.map((edge, i) => ({ ...edge, sections: [{ startPoint: { x: 400, y: 300 + i * 35 }, endPoint: { x: 800, y: 300 + i * 35 } }] }));
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'er-wiki-typed-reader-'));
  const browser = await chromium.launch({ headless: true, ...(process.env.ER_WIKI_CHROMIUM_EXECUTABLE ? { executablePath: process.env.ER_WIKI_CHROMIUM_EXECUTABLE } : {}) })
    .catch(async error => { await fs.rm(directory, { recursive: true, force: true }); throw error; });
  const context = await browser.newContext({ offline: true, acceptDownloads: true }); context.setDefaultTimeout(8000);
  const errors = [], requests = []; context.on('page', page => { page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); }); });
  const xml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const scene = legacy => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500">${result.layout.children.map(node => {
    const meta = result.projection.nodes.find(n => n.id === node.id);
    return `<g data-eda-node="${xml(node.id)}" data-table-id="${xml(String(meta.tableId))}" ${legacy ? '' : `data-table-key="${xml(JSON.stringify(meta.tableId))}"`} transform="translate(${node.x} ${node.y})" role="button" aria-label="${meta.title}"><rect width="${node.width}" height="${node.height}" fill="white" stroke="black"/><text x="12" y="26">${meta.title}</text>${meta.fields.map((field, i) => `<g data-eda-field="${xml(String(field.id))}" data-field-key="${xml(JSON.stringify(field.id))}" role="button" aria-label="${field.name}"><rect x="1" y="${78 + i * 30}" width="358" height="30" fill="white"/><text x="12" y="${98 + i * 30}">${field.name}</text></g>`).join('')}</g>`;
  }).join('')}${result.projection.edges.map((edge, i) => `<g data-eda-wire="${edge.id}" data-rel-ids="${xml(JSON.stringify(edge.refs))}" role="button" aria-label="${model.relationships.find(r => edge.refs.includes(r.id)).name}"><rect x="400" y="${293 + i * 35}" width="400" height="14" fill="transparent"/><path class="eda-wire" d="M 400 ${300 + i * 35} L 800 ${300 + i * 35}" stroke="black" fill="none" stroke-width="2"/></g>`).join('')}</svg>`;
  try {
    for (const legacy of [false, true]) {
      const file = path.join(directory, legacy ? 'legacy.html' : 'typed.html');
      await fs.writeFile(file, await exportReadingHtml(model, { layout: async () => result, sceneToSvg: () => scene(legacy) }));
      const page = await context.newPage(); await page.goto(pathToFileURL(file).href);
      await page.locator('#reader-directory').getByRole('button', { name: 'string_table', exact: true }).click();
      assert.equal(await page.locator('#reader-document h2').textContent(), 'string_table');
      assert.deepEqual(await page.locator('#reader-diagram .reader-selected').evaluateAll(nodes => nodes.map(n => JSON.parse(n.getAttribute('data-table-key')))), ['0']);
      await page.locator('#reader-directory').getByRole('button', { name: 'number_table', exact: true }).click();
      assert.deepEqual(await page.locator('#reader-diagram .reader-selected').evaluateAll(nodes => nodes.map(n => JSON.parse(n.getAttribute('data-table-key')))), [0]);
      await page.locator('#reader-document').getByRole('button', { name: 'hidden_note', exact: true }).click();
      assert.match(await page.locator('#reader-status').textContent(), /隐藏|hidden/i);
      await page.locator('#reader-document').getByRole('button', { name: 'string_field', exact: true }).click();
      assert.doesNotMatch(await page.locator('#reader-status').textContent(), /隐藏|hidden/i);
      await page.locator('#reader-diagram').getByRole('button', { name: 'string_field', exact: true }).click();
      assert.deepEqual(await page.locator('#reader-document tr.selected').evaluateAll(nodes => nodes.map(n => JSON.parse(n.dataset.readerFieldKey))), ['0']);
      assert.deepEqual(await page.locator('#reader-diagram .reader-field-selected').evaluateAll(nodes => nodes.map(n => JSON.parse(n.getAttribute('data-field-key')))), ['0']);
      assert.deepEqual(await page.locator('#reader-document [data-reader-relation-key]').evaluateAll(nodes => nodes.map(n => JSON.parse(n.dataset.readerRelationKey))), [0]);
      await page.locator('#reader-diagram').getByRole('button', { name: 'number_field', exact: true }).click();
      assert.deepEqual(await page.locator('#reader-document tr.selected').evaluateAll(nodes => nodes.map(n => JSON.parse(n.dataset.readerFieldKey))), [0]);
      assert.deepEqual(await page.locator('#reader-document [data-reader-relation-key]').evaluateAll(nodes => nodes.map(n => JSON.parse(n.dataset.readerRelationKey))), ['0']);
      await page.locator('#fit-view').click();
      await page.locator('#reader-diagram').getByRole('button', { name: 'string_relation', exact: true }).click();
      assert.deepEqual(await page.locator('#reader-diagram .reader-relation-selected').evaluateAll(nodes => nodes.flatMap(n => JSON.parse(n.getAttribute('data-rel-ids')))), ['0']);
      const downloadPromise = page.waitForEvent('download'); await page.locator('#download-model').click(); const download = await downloadPromise;
      const downloaded = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
      assert.equal(downloaded.format, 'er-wiki'); assert.equal(downloaded.schemaVersion, 4); assert.deepEqual(downloaded.reviewGroups, model.metadata.reviewGroups);
      assert.deepEqual(requireValidModelDocument(downloaded, { typeInfo: () => ({ isSized: false, hasPrecision: false, canIncrement: true }) }).model.tables.map(table => table.id), [0, '0']);
      assert.deepEqual(downloaded.relationships.map(r => r.id), [0, '0']); assert(!Object.hasOwn(downloaded, 'metadata'));
      await page.close();
    }
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  } finally { await browser.close(); await fs.rm(directory, { recursive: true, force: true }); }
});
