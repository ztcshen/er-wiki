import { registerHooks } from 'node:module';
import fs from 'node:fs';

// The pinned renderer uses bundler-style relative imports. Resolve those only
// inside its source tree; do not change package or application module resolution.
const root = new URL('../../work/drawdb/src/', import.meta.url).href;
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(root) && specifier.startsWith('.')) {
    const url = new URL(specifier, context.parentURL);
    for (const suffix of ['', '.js', '/index.js']) {
      const candidate = new URL(url.href + suffix);
      if (candidate.href.startsWith(root) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return next(candidate.href, context);
    }
  }
  return next(specifier, context);
} });
