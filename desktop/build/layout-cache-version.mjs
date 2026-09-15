import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Version cache entries by implementation, not app version: a release-note or
// translation change must not force every model through the layout engine again.
export function layoutCacheVersion(desktop, readFile = fs.readFileSync) {
  const hash = createHash('sha256');
  for (const name of ['model', 'layout', 'layout-content', 'layout-snapshot', 'metrics', 'ports', 'cardinality', 'relation-condition',
    'elk-graph', 'placement', 'optimize-layout', 'refine-positions', 'position-candidates', 'compact-layout', 'obstacle-router', 'layout-quality']) {
    hash.update(name).update(readFile(path.join(desktop, 'eda', name + '.mjs')));
  }
  for (const [file, key] of [[path.join(desktop, 'package.json'), 'elkjs'], [path.join(desktop, '../package.json'), 'libavoid-js']]) {
    hash.update(key).update(JSON.parse(readFile(file)).devDependencies[key]);
  }
  hash.update(readFile(path.join(desktop, 'review/relation-semantics.mjs')));
  hash.update(readFile(path.join(desktop, 'review/table-review.mjs')));
  return 'layout-cache-v1-' + hash.digest('hex').slice(0, 24);
}
