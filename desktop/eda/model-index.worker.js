import { createModelIndexEngine } from './model-index.mjs';
const engine = createModelIndexEngine(); let active = null;
self.onmessage = ({ data }) => {
  if (data.type === 'cancel') { if (active?.id === data.id) active.stopped = true; return; }
  if (data.type !== 'index') return;
  if (active) active.stopped = true;
  const job = active = { id: data.id, stopped: false };
  engine.build(data.model, { current: () => active === job && !job.stopped,
    onPhase: phase => { if (active === job && !job.stopped) self.postMessage({ id: job.id, type: 'phase', phase }); },
  }).then(index => { if (active === job && !job.stopped) self.postMessage({ id: job.id, type: 'ready', index }); })
    .catch(error => { if (active === job && !job.stopped) self.postMessage({ id: job.id, type: 'error', error: error.message }); });
};
