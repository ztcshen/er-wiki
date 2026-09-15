const { test } = require('node:test');
const assert = require('node:assert/strict');
test('layout observation requires matching model and geometry and does not regress a terminal state', async () => {
  const { createLayoutObserver } = await import('../eda/layout-observation.mjs');
  const sent = [], observer = createLayoutObserver(value => sent.push(value));
  observer.begin('request-a', 'model-a', 'geometry-a');
  assert.equal(observer.report({ modelId: 'model-b', layoutIdentity: 'geometry-a', layoutStatus: 'ready' }), false);
  assert.equal(observer.report({ modelId: 'model-a', layoutIdentity: 'old', layoutStatus: 'ready' }), false);
  assert.equal(observer.current('request-a').layoutStatus, 'pending');
  assert(observer.report({ modelId: 'model-a', layoutIdentity: 'geometry-a', layoutStatus: 'ready' }));
  observer.report({ modelId: 'model-a', layoutIdentity: 'geometry-a', layoutStatus: 'pending' });
  assert.equal(observer.current('request-a').layoutStatus, 'ready');
  assert.equal(sent.length, 1);
  observer.begin('request-b', 'model-b', 'geometry-b');
  assert.equal(observer.current('request-a'), null);
});
