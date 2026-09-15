const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
const source = fs.readFileSync(path.join(__dirname, '../../work/drawdb/src/components/Workspace.jsx'), 'utf8');

test('real workspace integration retains one hydration function, save lock and replacement API', async () => {
  const { integrateDesktop } = await import('../integrate.mjs');
  const output = integrateDesktop('/desktop')(source, '/src/components/Workspace.jsx');
  const ast = babel.parseSync(output, { configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] } });
  const declarations = new Map(), calls = new Map();
  babel.traverse(ast, {
    VariableDeclarator({ node }) { if (node.id.type === 'Identifier') declarations.set(node.id.name, (declarations.get(node.id.name) || 0) + 1); },
    CallExpression({ node }) { if (node.callee.type === 'Identifier') calls.set(node.callee.name, (calls.get(node.callee.name) || 0) + 1); },
  });
  assert.equal(declarations.get('applyDiagramState'), 1);
  assert.equal(declarations.get('replacementLockRef'), 1);
  assert.equal(calls.get('applyDiagramState'), 3);
  assert(output.includes('if (replacementLockRef.current) return;'));
  assert(output.includes('setUndoStack([]); setRedoStack([]);'));
});

test('workspace declaration drift cannot silently remove hydration or the save lock', async () => {
  const { integrateDesktop } = await import('../integrate.mjs');
  for (const anchor of ['  const load = useCallback(async () => {', '  const save = useCallback(async () => {', '  const savedModelContentRef = useRef(null);']) {
    for (const replacement of [anchor.replace(' = ', '  = '), '', anchor + '\n' + anchor]) {
      const changed = source.replace(anchor, replacement);
      assert.notEqual(changed, source);
      assert.throws(() => integrateDesktop('/desktop')(changed, '/src/components/Workspace.jsx'), /anchor|hydration/i, anchor);
    }
  }
});

test('replacement integration rejects missing, duplicate and reversed hydration/API anchors', async () => {
  const { integrateReplacement } = await import('../build/replacement.mjs');
  const api = '    isDirty: () => modelContent !== savedModelContentRef.current,';
  const input = source + '\nconst bridge = {\n' + api + '\n};';
  for (const anchor of ['    const applyDiagramState = (diagram) => {', '    const resetEditorState = () => {', api]) {
    for (const replacement of ['', anchor + '\n' + anchor]) {
      assert.throws(() => integrateReplacement(input.replace(anchor, replacement)), /anchor|hydration/i, anchor);
    }
  }
  const start = '    const applyDiagramState = (diagram) => {', end = '    const resetEditorState = () => {';
  const reversed = input.replace(start, '__TEMP_START__').replace(end, start).replace('__TEMP_START__', end);
  assert.throws(() => integrateReplacement(reversed), /anchor|hydration/i);
});
