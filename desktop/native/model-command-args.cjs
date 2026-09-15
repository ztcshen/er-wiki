const path = require('node:path');
const has = (argv, key) => argv.some(value => value === key || value.startsWith(key + '='));
const get = (argv, key, optional = false) => {
  const matches = argv.map((value, index) => ({ value, index })).filter(({ value }) => value === key || value.startsWith(key + '='));
  if (optional && matches.length === 0) return undefined;
  if (matches.length !== 1) throw new Error('Expected exactly one ' + key);
  const { value, index } = matches[0], result = value === key ? argv[index + 1] : value.slice(key.length + 1);
  if (!result || result.startsWith('--')) throw new Error('Missing ' + key);
  return result;
};
function modelCommandArgs(argv, cwd) {
  const operations = ['--replace-model', '--export-model', '--inspect-model'].filter(key => has(argv, key));
  if (!operations.length) return null;
  if (operations.length !== 1) throw new Error('Choose exactly one model operation');
  const operation = operations[0].slice(2);
  const targetId = get(argv, '--model-id', operation === 'inspect-model');
  if (targetId !== undefined && !/^[a-zA-Z0-9_-]{1,128}$/.test(targetId)) throw new Error('Invalid model ID');
  const expectedContentHash = get(argv, '--expected-content-hash', true);
  if (expectedContentHash !== undefined && (operation !== 'replace-model' || !/^[a-f0-9]{64}$/.test(expectedContentHash))) throw new Error('Invalid expected content hash');
  const overwrite = argv.includes('--overwrite');
  if (overwrite && (operation !== 'export-model' || argv.filter(value => value === '--overwrite').length !== 1)) throw new Error('Overwrite is only valid for explicit exports');
  if (operation === 'inspect-model' && argv.filter(value => value === '--inspect-model').length !== 1) throw new Error('Invalid inspect flag');
  return { operation, ...(targetId === undefined ? {} : { targetId }),
    ...(operation === 'inspect-model' ? {} : { file: path.resolve(cwd, get(argv, '--' + operation)) }),
    ...(expectedContentHash === undefined ? {} : { expectedContentHash }), ...(overwrite ? { overwrite: true } : {}) };
}
function replacementArgs(argv, cwd) {
  if (!has(argv, '--replace-model')) return null;
  const { operation, ...args } = modelCommandArgs(argv, cwd); return args;
}
module.exports = { modelCommandArgs, replacementArgs };
