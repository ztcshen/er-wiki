import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

// Compile source-authored UI strings only. Never walk rendered DOM or model data.
export function createUiLocalizer(root, { collect } = {}) {
  const require = createRequire(path.join(root, 'package.json'));
  const babel = require('@babel/core'), t = babel.types;
  const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'desktop/i18n/messages.json'), 'utf8'));
  const runtime = path.join(root, 'desktop/i18n/renderer.js');
  return (code, id) => {
    if (!id.endsWith('.jsx') || (!id.startsWith(path.join(root, 'desktop')) && !id.startsWith(path.join(root, 'work/drawdb/src/components')))) return code;
    if (!/[\u3400-\u9fff]/.test(code)) return code;
    let changed = false;
    const call = (message, values = []) => {
      collect?.(message);
      if (!collect && !Object.hasOwn(catalogue, message)) throw new Error(`Missing desktop translation in ${path.basename(id)}: ${JSON.stringify(message)}`);
      changed = true;
      return t.callExpression(t.identifier('__ui'), [t.stringLiteral(message), t.objectExpression(values.map((v, i) => t.objectProperty(t.identifier(`v${i}`), v)))]);
    };
    const result = babel.transformSync(code, { filename: id, configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] },
      plugins: [() => ({ visitor: {
        JSXText(p) {
          if (!/[\u3400-\u9fff]/.test(p.node.value)) return;
          const raw=p.node.value,translated=call(raw.replace(/\s+/g, ' ').trim());
          const prefix=/^\s/.test(raw)?' ':'',suffix=/\s$/.test(raw)?' ':'';
          p.replaceWith(t.jsxExpressionContainer(t.binaryExpression('+',t.binaryExpression('+',t.stringLiteral(prefix),translated),t.stringLiteral(suffix)))); p.skip();
        },
        TemplateLiteral: { exit(p) {
          if (!p.getFunctionParent() || !p.node.quasis.some(q => /[\u3400-\u9fff]/.test(q.value.cooked))) return;
          const message = p.node.quasis.map((q, i) => q.value.cooked + (i < p.node.expressions.length ? `{{v${i}}}` : '')).join('');
          p.replaceWith(call(message, p.node.expressions)); p.skip();
        } },
        StringLiteral(p) {
          if (!p.getFunctionParent() || !/[\u3400-\u9fff]/.test(p.node.value) || p.key === 'key' ||
            p.parentPath.isBinaryExpression() && p.parent.operator !== '+' || p.parentPath.isCallExpression() && p.parent.callee.name === '__ui') return;
          const value = call(p.node.value);
          p.replaceWith(p.parentPath.isJSXAttribute() ? t.jsxExpressionContainer(value) : value); p.skip();
        },
      } })] });
    if (!changed) return code;
    // Language changes rerender components, never remount the editing session.
    const subscribed = babel.transformSync(result.code, { filename: id, configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] },
      plugins: [() => ({ visitor: { Function(p) {
        const name = p.node.id?.name || (p.parentPath.isVariableDeclarator() ? p.parent.id.name : '');
        if (/^[A-Z]/.test(name) && t.isBlockStatement(p.node.body)) p.node.body.body.unshift(t.expressionStatement(t.callExpression(t.identifier('__useLocale'), [])));
      } } })] });
    return `import { tr as __ui, useLocale as __useLocale } from ${JSON.stringify(runtime)};\n${subscribed.code}`;
  };
}
