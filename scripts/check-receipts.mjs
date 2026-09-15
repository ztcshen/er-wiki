import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { conditionalModel } from '../desktop/test/fixtures/conditional-model.mjs';

export async function checkReceipts({ app, page, read, profile, out }) {
  const id = page.url().split('/').at(-1), file = path.join(out, 'receipt-input.json');
  let previousId;
  const submit = async contents => {
    await fs.writeFile(file, contents);
    await app.evaluate(({ app }, { file, id }) => app.emit('second-instance', {}, ['--replace-model', file, '--model-id', id], process.cwd()), { file, id });
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      let result;
      try { result = JSON.parse(await fs.readFile(path.join(profile, 'model-replacement-result.json'), 'utf8')); } catch {}
      if (result?.requestId && result.requestId !== previousId && ['succeeded', 'failed'].includes(result.status)) {
        previousId = result.requestId; return result;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('No matching terminal receipt');
  };
  const model = conditionalModel();
  const success = await submit(JSON.stringify(model));
  assert.equal(success.ok, true, JSON.stringify(success));
  assert.equal(success.layoutStatus, 'not_observed');
  const stored = await read();
  model.relationships[3].reviewEvidence.condition.field = 'missing';
  const invalid = await submit(JSON.stringify(model));
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errorCode, 'MODEL_VALIDATION_FAILED');
  assert(invalid.errors.some(error => error.code === 'CONDITION_FIELD_MISSING' && error.path === 'relationships[3].reviewEvidence.condition.field'));
  assert.deepEqual(await read(), stored);
  const malformed = await submit('{');
  assert.equal(malformed.errorCode, 'JSON_INVALID');
  assert.deepEqual(await read(), stored);
  console.log(JSON.stringify({ passed: true, out, checks: 'real native handoff: success, structured validation failure, malformed JSON, request IDs, unchanged stored model on failure' }));
}
