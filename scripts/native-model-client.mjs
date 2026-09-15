import fs from 'node:fs/promises';
import path from 'node:path';
export function nativeModelClient({ app, profile }) {
  let previousId;
  const wait = async predicate => {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      let result;
      try { result = JSON.parse(await fs.readFile(path.join(profile, 'model-replacement-result.json'), 'utf8')); } catch {}
      if (result && predicate(result)) return result;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('No matching native model receipt');
  };
  return {
    async send(args) {
      await app.evaluate(({ app }, argv) => app.emit('second-instance', {}, argv, process.cwd()), args);
      const result = await wait(value => value.requestId && value.requestId !== previousId && ['succeeded', 'failed'].includes(value.status));
      previousId = result.requestId; return result;
    },
    layout: requestId => wait(value => value.requestId === requestId && ['ready', 'failed', 'degraded'].includes(value.layoutStatus)),
  };
}
