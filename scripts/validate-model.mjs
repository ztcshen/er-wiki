import './lib/upstream-node.mjs';
import { readModelFile } from '../desktop/files.cjs';
import { validateModelDocument } from '../desktop/review/model-contract.mjs';
const { dbToTypes } = await import('../work/drawdb/src/data/datatypes.js');

const args = process.argv.slice(2);
const failure = (code, message) => ({ errors: [{ code, path: '', message }], warnings: [] });
let result, json;
if (args.length !== 3 || args[0] !== '--file' || !args[1] || args[2] !== '--json') {
  result = failure('ARGUMENTS_INVALID', 'Usage: node scripts/validate-model.mjs --file <model.json> --json');
  process.exitCode = 1;
} else {
  try { json = await readModelFile(args[1]); }
  catch (error) { result = failure('FILE_READ_FAILED', error.message); process.exitCode = 1; }
  if (json !== undefined) {
    let input;
    try { input = JSON.parse(json); }
    catch (error) { result = failure('JSON_INVALID', error.message); process.exitCode = 2; }
    if (input !== undefined) {
      const catalogue = dbToTypes[input?.database || 'generic'];
      result = validateModelDocument(input, { typeInfo: type => catalogue?.[type] || {} });
      // Browser-only custom type settings are not available to headless callers.
      // Built-in size/precision rules remain identical; report unknown metadata.
      for (const [ti, table] of (Array.isArray(result.model?.tables) ? result.model.tables : []).entries())
        for (const [fi, field] of (Array.isArray(table?.fields) ? table.fields : []).entries())
          if (field && !catalogue?.[field.type]) result.warnings.push({ code: 'TYPE_METADATA_UNAVAILABLE',
            path: `tables[${ti}].fields[${fi}].type`, message: 'Custom or unknown type: headless validation has no browser-only type metadata' });
      process.exitCode = result.errors.length ? 2 : 0;
    }
  }
}
console.log(JSON.stringify(result));
