const path = require('node:path');
const ORIGIN = 'erwiki://app';
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function isAppURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'erwiki:' && url.hostname === 'app' &&
      !url.port && !url.username && !url.password;
  } catch { return false; }
}

function assetPath(root, value) {
  if (!isAppURL(value)) return null;
  try {
    const pathname = decodeURIComponent(new URL(value).pathname);
    if (pathname.includes('\0') || pathname.includes('\\') ||
        pathname.split('/').includes('..')) return null;
    const route = /^\/(?:editor(?:\/(?:diagrams|templates)\/[^/]+)?\/?)?$/.test(pathname);
    const file = path.resolve(root, '.' + (route ? '/index.html' : pathname));
    return file.startsWith(path.resolve(root) + path.sep) ? file : null;
  } catch { return null; }
}

function safeRoute(value) {
  return typeof value === 'string' && /^\/editor\/diagrams\/[a-zA-Z0-9_-]{1,128}$/.test(value);
}

function safeFilename(value) {
  const name = String(value || '模型').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 100);
  return `${name || '模型'}.drawdb.json`;
}

function allowsPermission(permission, { focused, mainFrame, url }) {
  return focused && mainFrame && isAppURL(url) &&
    ['clipboard-read', 'clipboard-sanitized-write', 'fullscreen'].includes(permission);
}

module.exports = { ORIGIN, MAX_FILE_BYTES, isAppURL, assetPath, safeRoute, safeFilename, allowsPermission };
