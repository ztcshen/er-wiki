import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { conditionalModel } from '../desktop/test/fixtures/conditional-model.mjs';
import { nativeModelClient } from './native-model-client.mjs';

export async function checkReceipts({ app, page, read, profile, out }) {
  const id = page.url().split('/').at(-1), file = path.join(out, 'receipt-input.json');
  const client = nativeModelClient({ app, profile });
  const submit = async contents => {
    await fs.writeFile(file, contents);
    return client.send(['--replace-model', file, '--model-id', id]);
  };
  const model = conditionalModel();
  const success = await submit(JSON.stringify(model));
  assert.equal(success.ok, true, JSON.stringify(success));
  assert(['pending', 'ready', 'degraded'].includes(success.layoutStatus));
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
