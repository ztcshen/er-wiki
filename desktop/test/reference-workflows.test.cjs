const { test } = require('node:test');
const assert = require('node:assert/strict');
const indexModule = import('../eda/model-index.mjs');
const fixture = () => ({ tables: [
  { id: 0, name: 'orders', comment: 'Order facts', fields: [{ id: 0, name: 'id', comment: 'Identity' }, { id: 'status', name: 'status' }] },
  { id: '0', name: 'returns', fields: [{ id: 0, name: 'order_id' }] },
], relationships: [{ id: 'link', startTableId: '0', endTableId: 0, startFieldId: 0, endFieldId: 0, reviewEvidence: { kind: 'logical', status: 'candidate', description: 'Review evidence' } }], groups: [] });
const build = async model => (await indexModule).createModelIndexEngine().build(model, { yieldWork: async () => {} });

test('derived content cache reuses unchanged tables while references use current shared definitions', async () => {
  const { createModelIndexEngine, searchModelIndex, objectReferences } = await indexModule;
  const model = fixture(), before = JSON.stringify(model), engine = createModelIndexEngine();
  const first = await engine.build(model); assert.equal(first.stats.misses, 2);
  const next = structuredClone(model); next.tables[0].comment = 'Latest explanation'; next.relationships[0].reviewEvidence.status = 'confirmed';
  const second = await engine.build(next); assert.equal(second.stats.hits, 1); assert.equal(second.stats.misses, 1);
  assert.equal(searchModelIndex(second, next, 'latest')[0].table, next.tables[0]);
  assert.deepEqual(objectReferences(second, 0, 0).incoming.map(r => r.id), ['link']);
  assert.deepEqual(objectReferences(second, '0', 0).outgoing.map(r => r.id), ['link']);
  assert.equal(objectReferences(second, '0', 0).incoming.length, 0);
  assert.equal(second.references[0].status, 'confirmed'); assert.equal(JSON.stringify(model), before);
  assert(!Object.hasOwn(first.tables[0], 'table')); assert(!Object.hasOwn(first.tables[0].fields[0], 'field'));
});

test('index readiness requires both table and reference stages and suppresses cancelled generations', async () => {
  const { createModelIndexEngine } = await indexModule, engine = createModelIndexEngine();
  let release, current = true; const phases = [];
  const task = engine.build(fixture(), { current: () => current, onPhase: p => phases.push(p.phase), yieldWork: () => new Promise(r => { release = r; }) });
  await Promise.resolve(); assert.deepEqual(phases, ['tables']);
  current = false; release(); await assert.rejects(task, { code: 'INDEX_CANCELLED' }); assert(!phases.includes('ready'));
  const complete = await engine.build(fixture(), { yieldWork: async () => {}, onPhase: p => phases.push(p.phase) });
  assert.equal(complete.ready, true); assert.deepEqual(phases.slice(-3), ['tables', 'references', 'ready']);
});

test('missing endpoints and invalid fields remain observable references rather than false confirmed links', async () => {
  const model = fixture(); model.relationships.push({ id: 'broken', startTableId: 0, endTableId: 'gone', startFieldId: 'missing', endFieldId: 0 });
  const index = await build(model); assert.equal(index.stats.unresolved, 1); const ref = index.references.find(r => r.id === 'broken');
  assert.equal(ref.valid, false); assert(ref.problems.includes('目标表不存在')); assert(ref.problems.includes('源字段不存在'));
  assert(index.outgoing[JSON.stringify(0)].includes('broken'));
});

test('condition validation reindexes when SQL enum values change without changing field identities', async () => {
  const { modelIndexKey } = await indexModule, model = fixture();
  model.tables[0].fields[1] = { id: 'status', name: 'status', type: 'ENUM', values: ['pending'] };
  model.relationships[0].startTableId = 0;
  model.relationships[0].reviewEvidence.condition = { field: 'status', value: 'pending' };
  const initial = await build(model), changed = structuredClone(model); changed.tables[0].fields[1].values = ['complete'];
  assert.equal(initial.references[0].valid, true); assert.notEqual(modelIndexKey(changed), modelIndexKey(model));
  assert.equal((await build(changed)).references[0].valid, false);
});

test('one reusable index worker rejects obsolete requests and only its owner terminates it', async () => {
  const { createModelIndexService } = await import('../eda/model-index-task.mjs');
  let terminated = 0, created = 0; const sent = [], worker = { postMessage: m => sent.push(m), terminate: () => terminated++ };
  const service = createModelIndexService({ createWorker: () => { created++; return worker; } });
  const first = service.request(fixture()), rejected = assert.rejects(first.promise, { code: 'INDEX_CANCELLED' });
  const second = service.request(fixture()); await rejected;
  worker.onmessage({ data: { id: 1, type: 'ready', index: { old: true } } });
  const good = await build(fixture()); worker.onmessage({ data: { id: 2, type: 'ready', index: good } }); assert.equal(await second.promise, good);
  assert.equal(created, 1); assert.equal(terminated, 0); assert(sent.some(m => m.type === 'cancel' && m.id === 1));
  const third = service.request(fixture()), closed = assert.rejects(third.promise, { code: 'INDEX_CANCELLED' }); const late = worker.onmessage;
  service.dispose(); service.dispose(); await closed; late({ data: { id: 3, type: 'ready', index: good } });
  assert.equal(terminated, 1); assert.equal(worker.onmessage, null);
});

test('index failure is explicit and a subsequent request can recover using the local engine', async () => {
  const { createModelIndexService } = await import('../eda/model-index-task.mjs'); let terminated = 0;
  const worker = { postMessage() {}, terminate() { terminated++; } }, service = createModelIndexService({ createWorker: () => worker });
  const first = service.request(fixture()), failure = assert.rejects(first.promise, /worker failed/); worker.onerror({ message: 'worker failed' }); await failure;
  assert.equal((await service.request(fixture()).promise).ready, true); assert.equal(terminated, 1); service.dispose();
  const slow = createModelIndexService({ createWorker: () => ({ postMessage() {}, terminate() {} }), timeoutMs: 5 });
  await assert.rejects(slow.request(fixture()).promise, /超时/); slow.dispose();
});

test('frame mailbox handles zero, coalesces latest state and rejects cancelled callbacks', async () => {
  const { createFrameMailbox } = await import('../eda/frame-mailbox.mjs'); const queued = [], cancelled = [], published = [];
  const box = createFrameMailbox({ request: cb => { queued.push(cb); return queued.length - 1; }, cancel: id => cancelled.push(id), publish: v => published.push(v) });
  box.push('one'); box.push('two'); assert.equal(queued.length, 1); box.flush(); assert.deepEqual(published, ['two']); assert.deepEqual(cancelled, [0]);
  box.push('three'); queued[0](); assert.deepEqual(published, ['two'], 'late flushed callback must not consume a newer frame'); queued[1](); assert.deepEqual(published, ['two','three']);
  box.push('stale'); box.clear(); queued[2](); assert.deepEqual(published, ['two','three']);
  box.push('disposed'); box.dispose(); queued[3](); box.push('ignored'); assert.deepEqual(published, ['two','three']);
});

test('worker message transport failures release requests and allow indexing to recover', async () => {
  const { createModelIndexService } = await import('../eda/model-index-task.mjs'); let terminated = 0;
  const broken = { postMessage() { throw Error('transport failed'); }, terminate() { terminated++; } };
  const service = createModelIndexService({ createWorker: () => broken });
  await assert.rejects(service.request(fixture()).promise, /transport failed/);
  assert.equal((await service.request(fixture()).promise).ready, true); service.dispose(); assert.equal(terminated, 1);
  const cancelling = createModelIndexService({ createWorker: () => ({ postMessage(message) { if (message.type === 'cancel') throw Error('closed port'); }, terminate() { terminated++; } }) });
  const task = cancelling.request(fixture()), rejected = assert.rejects(task.promise, { code: 'INDEX_CANCELLED' });
  cancelling.dispose(); await rejected; assert.equal(terminated, 2);
});

test('reading writes wait for joint readiness, flush latest state and stop after disposal', async () => {
  const { createReadingPersistence } = await import('../eda/reading-persistence.mjs'); const callbacks = [], writes = [], cancelled = [];
  const owner = createReadingPersistence({ write: value => writes.push(value), schedule: cb => { callbacks.push(cb); return callbacks.length - 1; }, cancel: id => cancelled.push(id) });
  owner.update({ placeholder: true }, false); assert.equal(owner.flush(), false); assert.deepEqual(writes, []);
  owner.update({ view: 'first' }, true); owner.update({ view: 'restoring' }, false); callbacks[0](); assert.deepEqual(writes, []);
  owner.update({ view: 'current' }, true); assert(owner.flush()); assert.deepEqual(writes, [{ view: 'current' }]); assert(cancelled.includes(0));
  owner.dispose(); callbacks.at(-1)(); owner.update({ view: 'after-close' }, true); assert.deepEqual(writes, [{ view: 'current' }]);
});

test('named workspace restoration prunes obsolete selection without changing model definitions', async () => {
  const { cleanReadingLayout, cleanReadingWorkspaces, restoreWorkspaceState } = await import('../eda/reading-workspaces.mjs');
  const { normalizeReadingState } = await import('../eda/reading-state.mjs'); const { canonicalModelContent } = await import('../renderer/model-content.mjs');
  const model = fixture(), content = canonicalModelContent(model), snapshot = { location: { level: 'column', tableId: 'deleted', selectedTable: 'deleted' },
    view: [80,90,900,700], layout: { direction: 'vertical', children: [{ id: 'context', active: 'references', visible: true }] } };
  const state = restoreWorkspaceState(normalizeReadingState({}), snapshot, model);
  assert.equal(state.location.tableId, null); assert.equal(state.layout.direction, 'vertical'); assert.equal(state.layout.children[1].active, 'references');
  assert.deepEqual(cleanReadingLayout({ children: [{ id: 'context', active: 'script', children: [{ view: 'html' }] }] }).children[1].children.map(v => v.view), ['details','references','queries']);
  assert.equal(cleanReadingWorkspaces([{ id: 'a', name: 'First', snapshot }, { id: 'a', name: 'Duplicate', snapshot }]).length, 1);
  assert.equal(cleanReadingWorkspaces([{ id: 'b', name: 'Old workspace', snapshot: null }]).length, 1);
  assert.equal(cleanReadingLayout({ children: [null, { id: 'context', active: 'references' }] }).children[1].active, 'references');
  assert.deepEqual(normalizeReadingState({ layout: null, views: { scope: [0,0,900,600] } }).views.scope, [0,0,900,600]);
  assert.equal(canonicalModelContent({ ...model, reading: state, workspaces: [snapshot] }), content);
});

test('saved review queries are declarative projections with current typed identifiers', async () => {
  const { runReviewQuery, validateReviewQueries, BUILTIN_QUERIES } = await import('../eda/review-queries.mjs'); const model = fixture(), before = JSON.stringify(model), index = await build(model);
  assert.deepEqual(runReviewQuery(BUILTIN_QUERIES[0], model, index).map(r => r.relationshipId), ['link']);
  assert.deepEqual(runReviewQuery(BUILTIN_QUERIES[1], model, index).map(r => [r.tableId,r.fieldId]), [[0,'status'],['0',0]]);
  const query = { id: 'named', name: 'Orders only', target: 'fields', filters: { text: 'orders', documentation: 'missing' } };
  validateReviewQueries([query]); assert.deepEqual(runReviewQuery(query, model, index).map(r => r.tableId), [0]);
  assert(!Object.hasOwn(runReviewQuery(query, model, index)[0], 'field')); assert.equal(JSON.stringify(model), before);
  for (const wrong of [{ ...query, name: 12 }, { ...query, filters: { expression: 'process.exit()' } }, { ...query, target: 'script' }, { ...query, id: 'builtin:custom' }]) assert.throws(() => validateReviewQueries([wrong]));
});

test('model v4 persists query definitions while legacy v3 and shared tables roundtrip intact', async () => {
  const { migrateModelDocument } = await import('../renderer/model-format.mjs'); const { canonicalModelContent } = await import('../renderer/model-content.mjs'); const original = fixture();
  const migrated = migrateModelDocument({ ...original, schemaVersion: 3 }); assert.equal(migrated.schemaVersion, 4); assert.deepEqual(migrated.reviewQueries, []);
  const query = { id: 'custom', name: 'Undocumented fields', target: 'fields', filters: { documentation: 'missing' } };
  const document = migrateModelDocument({ ...migrated, reviewQueries: [query] }); assert.deepEqual(document.tables, original.tables);
  assert.deepEqual(migrateModelDocument(JSON.parse(JSON.stringify(document))).reviewQueries, [query]);
  assert.notEqual(canonicalModelContent(document), canonicalModelContent(migrated));
  assert.throws(() => migrateModelDocument({ ...document, schemaVersion: 5 }), /newer/);
});

test('persistent layout blobs deduplicate identical snapshots and garbage collect unreferenced content', async () => {
  const { IDBFactory } = await import('fake-indexeddb'); const { createLayoutCache, LAYOUT_DATABASE_VERSION } = await import('../eda/layout-cache.mjs');
  const factory = new IDBFactory(), cache = createLayoutCache({ factory, name: 'content-layouts', maxEntries: 2 });
  await cache.put('model-a:scope', 'shape', { geometry: 1 }); await cache.put('model-b:scope', 'shape', { geometry: 1 }); await cache.close();
  const db = await new Promise(resolve => { const r = factory.open('content-layouts', LAYOUT_DATABASE_VERSION); r.onsuccess = () => resolve(r.result); });
  const count = name => new Promise(resolve => { const tx = db.transaction(name), r = tx.objectStore(name).count(); r.onsuccess = () => resolve(r.result); });
  assert.equal(await count('layouts'), 2); assert.equal(await count('contents'), 1); db.close();
  const next = createLayoutCache({ factory, name: 'content-layouts', maxEntries: 2 }); await next.put('new', 'other', { geometry: 2 }); await next.close();
  const check = createLayoutCache({ factory, name: 'content-layouts', maxEntries: 2 }); assert.deepEqual(await check.get('new','other'), { geometry: 2 }); await check.close();
});
