const { test } = require('node:test');
const assert = require('node:assert/strict');
const cacheModule = import('../eda/layout-cache.mjs');
const snapshotModule = import('../eda/layout-snapshot.mjs');

async function fixture(options = {}) {
  const { conditionalModel } = await import('./fixtures/conditional-model.mjs');
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const { geometryKey } = await import('../eda/layout-content.mjs');
  const model = conditionalModel(), location = { level: 'overview', labels: 'off', ...options };
  const result = await arrangeSchematic(model, { ...location, optimize: false });
  return { model, options: location, result, shape: geometryKey(model, location) };
}

test('persistent cache survives a fresh instance; model/scope/shape/version stay isolated', async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  const { createLayoutCache } = await cacheModule;
  const factory = new IDBFactory(), config = { factory, version: 'engine-a' };
  const first = createLayoutCache(config);
  assert(await first.put('model-a:overview', 'shape-a', { test: 1 }));
  assert(await first.put('model-b:overview', 'shape-a', { test: 2 }));
  assert(await first.put('model-a:domain', 'shape-a', { test: 3 }));
  await first.close();
  const next = createLayoutCache(config);
  assert.deepEqual(await next.get('model-a:overview', 'shape-a'), { test: 1 });
  assert.deepEqual(await next.get('model-b:overview', 'shape-a'), { test: 2 });
  assert.deepEqual(await next.get('model-a:domain', 'shape-a'), { test: 3 });
  assert.equal(await next.get('model-a:overview', 'shape-b'), null);
  const upgraded = createLayoutCache({ ...config, version: 'engine-b' });
  assert.equal(await upgraded.get('model-a:overview', 'shape-a'), null);
  await next.close(); await upgraded.close();
});

test('cache checksums reject corrupted data and retention bounds discard old entries', async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  const { createLayoutCache } = await cacheModule;
  const factory = new IDBFactory(), config = { factory, name: 'bounded', maxEntries: 2, maxBytes: 1000, maxEntryBytes: 500 };
  const cache = createLayoutCache(config);
  await cache.put('a', 'x', { n: 1 }); await cache.put('b', 'x', { n: 2 }); await cache.put('c', 'x', { n: 3 });
  assert.equal(await cache.put('large', 'x', 'x'.repeat(600)), false);
  await cache.close();
  const db = await new Promise((resolve, reject) => { const r = factory.open('bounded', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  await new Promise((resolve, reject) => {
    const tx = db.transaction('layouts', 'readwrite'), store = tx.objectStore('layouts');
    const r = store.getAll(); r.onsuccess = () => { assert.equal(r.result.length, 2); const c = r.result.find(v => v.key === 'c'); c.data = '{"n":99}'; store.put(c); };
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  }); db.close();
  const reopened = createLayoutCache(config);
  assert.equal(await reopened.get('c', 'x'), null);
  await reopened.close();
});

test('blocked/unavailable storage falls back promptly without touching model storage', async () => {
  const { createLayoutCache } = await cacheModule;
  const cache = createLayoutCache({ factory: { open: () => ({}) }, timeoutMs: 10 });
  assert.equal(await cache.get('model', 'shape'), null);
  const failed = createLayoutCache({ factory: { open: () => { throw Error('denied'); } } });
  assert.equal(await failed.get('model', 'shape'), null);
  assert.equal(await failed.put('model', 'shape', { x: 1 }), false);
  assert.deepEqual(await failed.get('model', 'shape'), { x: 1 }, 'In-session cache works without disk access');
});

test('geometry-only snapshots restore current names, enums and relationship content', async () => {
  const { layoutSnapshot, restoreLayoutSnapshot } = await snapshotModule;
  const { geometryKey } = await import('../eda/layout-content.mjs');
  const { model, options, result, shape } = await fixture();
  model.tables[0].comment = 'CURRENT-COMMENT';
  model.tables[0].name = 'renamed_business_table';
  model.tables[0].fields[0].reviewEnumValues = [{ value: 'A', label: 'CURRENT-ENUM' }];
  assert.equal(geometryKey(model, options), shape);
  const snapshot = layoutSnapshot(result), text = JSON.stringify(snapshot);
  snapshot.quality = { badgeOverlaps: 999999 };
  assert(!text.includes('Fictional conditional relation example'));
  const restored = restoreLayoutSnapshot(snapshot, model, options);
  assert.notEqual(restored.quality.badgeOverlaps, 999999, 'cached quality must be recomputed from current badge geometry');
  const node = restored.projection.nodes.find(n => n.tableId === model.tables[0].id);
  assert.equal(node.title, 'renamed_business_table'); assert.equal(node.comment, 'CURRENT-COMMENT');
  assert.equal(node.fields[0].reviewEnumValues[0].label, 'CURRENT-ENUM');
  assert.deepEqual(restored.layout.children.map(n => [n.id, n.x, n.y]), result.layout.children.map(n => [n.id, n.x, n.y]));
  const bad = structuredClone(snapshot); bad.layout.children[0].ports[0].x = -999;
  assert.throws(() => restoreLayoutSnapshot(bad, model, options));
});

test('restoration retains auto Net Label cuts and four-sided port geometry', async () => {
  const { arrangeSchematic } = await import('../eda/layout.mjs');
  const { movePorts } = await import('../eda/ports.mjs');
  const { loadObstacleRouter, routeObstacles } = await import('../eda/obstacle-router.mjs');
  const { layoutSnapshot, restoreLayoutSnapshot } = await snapshotModule;
  const { model } = await fixture();
  const options = { level: 'overview', labels: 'auto', longThreshold: 1, optimize: false };
  const result = await arrangeSchematic(model, options);
  assert(result.longCuts.length > 0);
  const pin = result.projection.nodes.find(n => n.kind === 'table').ports[0];
  result.projection = movePorts(result.projection, [{ id: pin.id, side: 'NORTH' }]);
  result.layout = routeObstacles(await loadObstacleRouter(), result.projection, result.layout);
  const restored = restoreLayoutSnapshot(layoutSnapshot(result), model, options);
  const nextPin = restored.projection.nodes.flatMap(n => n.ports).find(p => p.id === pin.id);
  assert.equal(nextPin.layoutOptions['elk.port.side'], 'NORTH');
  assert.equal(nextPin.y, 0);
  assert.deepEqual(restored.projection.covered, result.projection.covered);
  assert.deepEqual(restored.layout.edges.flatMap(e => e.labels || []).map(l => l.text), result.layout.edges.flatMap(e => e.labels || []).map(l => l.text));
});

test('cache hits never create a worker; force and structural changes recompute once', async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  const { createLayoutCache } = await cacheModule;
  const { createCachedLayoutTask } = await import('../eda/cached-layout-task.mjs');
  const { model, options, result, shape } = await fixture();
  const factory = new IDBFactory(); let calls = 0;
  const args = { modelId: 'a', scope: 'overview', model, options, shape, computeDelayMs: 0,
    compute: () => { calls++; return { promise: Promise.resolve(result), cancel() {} }; } };
  let cache = createLayoutCache({ factory });
  assert.equal((await createCachedLayoutTask({ ...args, cache }).promise).cacheSource, 'computed');
  await cache.close(); cache = createLayoutCache({ factory });
  assert.equal((await createCachedLayoutTask({ ...args, cache }).promise).cacheSource, 'cache');
  assert.equal(calls, 1);
  assert.equal((await createCachedLayoutTask({ ...args, cache, force: true }).promise).cacheSource, 'computed');
  assert.equal(calls, 2);
  assert.equal((await createCachedLayoutTask({ ...args, cache }).promise).cacheSource, 'cache');
  assert.equal((await createCachedLayoutTask({ ...args, cache, shape: shape + 'changed' }).promise).cacheSource, 'computed');
  assert.equal(calls, 3); await cache.close();
});

test('cancelled cache lookups and stale computations cannot launch or save work', async () => {
  const { createCachedLayoutTask } = await import('../eda/cached-layout-task.mjs');
  const { model, options, result, shape } = await fixture();
  let releaseRead, releaseCompute, reads = 0, workers = 0, writes = 0;
  const cache = { get: () => { reads++; return new Promise(r => { releaseRead = r; }); }, put: async () => { writes++; } };
  const args = { modelId: 'a', scope: 'overview', model, options, shape, cache, computeDelayMs: 0,
    compute: () => { workers++; return { promise: new Promise(r => { releaseCompute = r; }), cancel() {} }; } };
  const first = createCachedLayoutTask(args), firstCheck = assert.rejects(first.promise, { code: 'LAYOUT_CANCELLED' });
  while (!reads) await new Promise(r => setTimeout(r, 1));
  first.cancel(); releaseRead(null); await firstCheck; assert.equal(workers, 0);
  const second = createCachedLayoutTask({ ...args, force: true }), secondCheck = assert.rejects(second.promise, { code: 'LAYOUT_CANCELLED' });
  while (!workers) await new Promise(r => setTimeout(r, 1));
  second.cancel(); releaseCompute(result); await secondCheck; assert.equal(writes, 0);
});

test('invalid geometry cache is recomputed rather than displayed', async () => {
  const { createCachedLayoutTask } = await import('../eda/cached-layout-task.mjs');
  const { model, options, result, shape } = await fixture(); let calls = 0;
  const value = await createCachedLayoutTask({ modelId: 'a', scope: 'overview', model, options, shape, computeDelayMs: 0,
    cache: { get: async () => ({ broken: true }), put: async () => { throw Error('quota'); } },
    compute: () => { calls++; return { promise: Promise.resolve(result), cancel() {} }; },
  }).promise;
  assert.equal(calls, 1); assert.equal(value.cacheSource, 'computed');
});

test('cache fingerprint follows algorithm code and dependencies, not release metadata', async () => {
  const fs = require('node:fs'), path = require('node:path');
  const { layoutCacheVersion } = await import('../build/layout-cache-version.mjs');
  const root = path.resolve(__dirname, '..'), before = layoutCacheVersion(root);
  assert.match(before, /^layout-cache-v1-[0-9a-f]{24}$/);
  assert.equal(layoutCacheVersion(root, file => file.endsWith('package.json') ? JSON.stringify({ ...JSON.parse(fs.readFileSync(file)), version: '99.0.0' }) : fs.readFileSync(file)), before);
  assert.notEqual(layoutCacheVersion(root, file => file.endsWith('ports.mjs') ? fs.readFileSync(file) + '\n// algorithm revision' : fs.readFileSync(file)), before);
});

test('geometry keys include overview field choices and internal system membership', async () => {
  const { geometryKey } = await import('../eda/layout-content.mjs');
  const { model } = await fixture();
  const table = model.tables[0];
  table.fields.push({ id: 'a', name: 'a' }, { id: 'b', name: 'b' });
  table.reviewOverviewFields = ['a']; const before = geometryKey(model, {});
  table.reviewOverviewFields = ['b']; assert.notEqual(geometryKey(model, {}), before);
  const system = geometryKey(model, { level: 'system' });
  model.tables.push({ id: 'extra', name: 'extra', fields: [] });
  model.groups[0].tableIds.push('extra');
  assert.notEqual(geometryKey(model, { level: 'system' }), system);
});
