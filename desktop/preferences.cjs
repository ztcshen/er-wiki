const fs = require('node:fs');
const { atomicWrite } = require('./files.cjs');
const messages = require('./i18n/messages.json');

function resolveLanguage(choice, systemLanguage) {
  return choice === 'zh' || choice === 'en' ? choice : /^zh(?:-|$)/i.test(systemLanguage || '') ? 'zh' : 'en';
}
function translate(language, text, values = {}) {
  return (language === 'en' ? messages[text] || text : text).replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? ''));
}
function createPreferences(file, systemLanguage) {
  let configured = false;
  let data = { language: 'system', autoBackup: true, backupCount: 20 };
  try { const old = JSON.parse(fs.readFileSync(file, 'utf8')); data = { ...data,
    language: ['system', 'zh', 'en'].includes(old.language) ? old.language : 'system',
    autoBackup: old.autoBackup !== false, backupCount: [10, 20, 50].includes(old.backupCount) ? old.backupCount : 20 }; configured = true; } catch { /* first launch */ }
  let queue = Promise.resolve();
  const get = () => ({ ...data, configured, resolvedLanguage: resolveLanguage(data.language, systemLanguage()) });
  return { get, update(value) {
    if (!value || Object.keys(value).some(k => !['language', 'autoBackup', 'backupCount'].includes(k)) ||
      value.language !== undefined && !['system', 'zh', 'en'].includes(value.language) ||
      value.autoBackup !== undefined && typeof value.autoBackup !== 'boolean' ||
      value.backupCount !== undefined && ![10, 20, 50].includes(value.backupCount)) return Promise.reject(new Error('Invalid preferences'));
    const task = queue.then(async () => { const next = { ...data, ...value }; await atomicWrite(file, JSON.stringify(next)); data = next; configured = true; return get(); });
    queue = task.catch(() => {}); return task;
  }, tr: (text, values) => translate(get().resolvedLanguage, text, values) };
}
module.exports = { resolveLanguage, translate, createPreferences };
