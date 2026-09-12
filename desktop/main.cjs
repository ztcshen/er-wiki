const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, session, shell, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { ORIGIN, MAX_FILE_BYTES, isAppURL, assetPath, safeRoute, safeFilename, allowsPermission } = require('./security.cjs');
const { atomicWrite, readModelFile } = require('./files.cjs');
const { createPreferences } = require('./preferences.cjs');
const { createBackupStore } = require('./backups.cjs');
const { checkUpdates, RELEASES } = require('./updates.cjs');
const APP_VERSION = require('./package.json').version;

app.setName('ER Wiki');
// Stable across upgrades and app locations, separate from every web browser.
app.setPath('userData', process.env.ER_WIKI_TEST_PROFILE
  ? path.resolve(process.env.ER_WIKI_TEST_PROFILE)
  : path.join(app.getPath('appData'), 'ER Wiki Community'));
protocol.registerSchemesAsPrivileged([{ scheme: 'erwiki', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
} }]);

let window;
let closePending = false;
let mayClose = false;
let busyDialog = false;
const pending = new Map();
const stateFile = path.join(app.getPath('userData'), 'window-state.json');
const preferences = createPreferences(path.join(app.getPath('userData'), 'preferences.json'), () => app.getLocale());
const backups = createBackupStore(path.join(app.getPath('userData'), 'backups'));
const tr = (text, values) => preferences.tr(text, values);
function localized(value) {
  if (Array.isArray(value)) return value.map(v => typeof v === 'string' ? tr(v) : localized(v));
  if (!value || typeof value !== 'object') return value;
  const roles = { about:'关于 ER Wiki',hide:'隐藏 ER Wiki',hideOthers:'隐藏其他应用',unhide:'显示全部',quit:'退出 ER Wiki',
    close:'关闭窗口',cut:'剪切',copy:'复制',paste:'粘贴',selectAll:'全选',togglefullscreen:'切换全屏',toggleDevTools:'开发者工具',minimize:'最小化',zoom:'缩放窗口',front:'全部置于前台' };
  if(value.role && !value.label && roles[value.role])value={...value,label:roles[value.role]};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    ['label', 'title', 'message', 'detail'].includes(key) && typeof item === 'string' ? tr(item) : localized(item)]));
}
let state = {};
try {
  const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) state = parsed;
} catch { /* First launch or damaged window metadata; model data is separate. */ }

function trusted(event) {
  if (!window || event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame || !isAppURL(event.senderFrame.url)) {
    throw new Error('Untrusted desktop request');
  }
}

async function nativeDialog(work) {
  if (busyDialog) throw new Error(tr('请先关闭当前文件对话框'));
  busyDialog = true;
  try { return await work(); } finally { busyDialog = false; }
}

function command(action) {
  if (!window || window.isDestroyed()) return Promise.resolve(false);
  const id = randomUUID();
  return new Promise(resolve => {
    // Failure to respond must never silently discard an editor.
    const timer = setTimeout(() => { pending.delete(id); resolve(false); }, 120000);
    pending.set(id, ok => { clearTimeout(timer); pending.delete(id); resolve(ok); });
    window.webContents.send('desktop:command', { id, action });
  });
}

ipcMain.on('desktop:command-result', (event, result) => {
  try { trusted(event); } catch { return; }
  if (typeof result?.id === 'string') pending.get(result.id)?.(result.ok === true);
});
ipcMain.handle('desktop:request-close', event => {
  trusted(event);
  window.close();
});
ipcMain.handle('desktop:confirm-leave', event => {
  trusted(event);
  return nativeDialog(async () => {
    const { response } = await dialog.showMessageBox(window, localized({
      type: 'question', message: '当前模型有尚未保存的修改',
      detail: '保存到桌面工作区后继续？视角记忆不会代替模型保存。',
      buttons: ['保存并继续', '取消', '不保存'], defaultId: 0, cancelId: 1,
      noLink: true,
    }));
    return ['save', 'cancel', 'discard'][response];
  });
});
ipcMain.handle('desktop:open-model', (event, kind = 'json') => {
  trusted(event);
  if (!['json', 'sql'].includes(kind)) throw new Error('Invalid import format');
  return nativeDialog(async () => {
    const result = await dialog.showOpenDialog(window, localized({
      title: '导入模型副本（不覆盖已有模型）', properties: ['openFile'],
      filters: [{ name: kind === 'sql' ? 'SQL DDL' : 'drawDB JSON', extensions: kind === 'sql' ? ['sql'] : ['json', 'ddb'] }],
    }));
    if (result.canceled || !result.filePaths[0]) return null;
    return { name: path.basename(result.filePaths[0]), json: await readModelFile(result.filePaths[0]) };
  });
});
ipcMain.handle('desktop:export-model', (event, payload) => {
  trusted(event);
  if (typeof payload?.json !== 'string' || Buffer.byteLength(payload.json) > MAX_FILE_BYTES ||
      typeof payload.name !== 'string' || payload.name.length > 500) throw new Error('Invalid export');
  const data = JSON.parse(payload.json);
  if (!Array.isArray(data.tables) || !Array.isArray(data.relationships)) throw new Error('Invalid model');
  return nativeDialog(async () => {
    const result = await dialog.showSaveDialog(window, localized({
      title: '导出当前模型 JSON', defaultPath: safeFilename(payload.name),
      filters: [{ name: 'drawDB 模型', extensions: ['json'] }],
    }));
    if (result.canceled || !result.filePath) return false;
    await atomicWrite(result.filePath, payload.json);
    return true;
  });
});

ipcMain.handle('desktop:get-preferences', event => { trusted(event); return { ...preferences.get(), version: APP_VERSION, platform: process.platform }; });
ipcMain.handle('desktop:set-preferences', async (event, value) => {
  trusted(event); const result = await preferences.update(value); installMenu();
  window?.setTitle(tr('ER Wiki · 数据模型工作台'));
  return result;
});
ipcMain.handle('desktop:create-backup', async (event, value, automatic = false) => {
  trusted(event); if (automatic && !preferences.get().autoBackup) return null;
  return backups.create(value, preferences.get().backupCount);
});
ipcMain.handle('desktop:list-backups', (event, modelId) => { trusted(event); if (typeof modelId !== 'string') throw new Error('Invalid model ID'); return backups.list(modelId); });
ipcMain.handle('desktop:read-backup', (event, id) => { trusted(event); return backups.read(id); });
ipcMain.handle('desktop:check-updates', event => { trusted(event); return checkUpdates(APP_VERSION); });
ipcMain.handle('desktop:open-resource', (event, resource) => {
  trusted(event);
  if (resource === 'data') return shell.openPath(app.getPath('userData'));
  const links = { releases: RELEASES, feedback: 'https://github.com/ztcshen/er-wiki/issues/new/choose', guide: 'https://github.com/ztcshen/er-wiki/blob/main/docs/USER_GUIDE.md' };
  if (!Object.hasOwn(links, resource)) throw new Error('Unknown resource');
  return shell.openExternal(links[resource]);
});
ipcMain.handle('desktop:export-asset', async (event, payload) => {
  trusted(event);
  if (!payload || !['svg', 'png', 'sql'].includes(payload.extension) || typeof payload.name !== 'string' || payload.name.length > 500 ||
    typeof payload.content !== 'string' || Buffer.byteLength(payload.content) > MAX_FILE_BYTES * 4) throw new Error('Invalid export asset');
  const bytes = payload.extension === 'png' ? Buffer.from(payload.content, 'base64') : Buffer.from(payload.content);
  if (bytes.length > MAX_FILE_BYTES * 3 || payload.extension === 'png' && !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw new Error('Invalid export content');
  return nativeDialog(async () => {
    const result = await dialog.showSaveDialog(window, { title: tr('导出图形或 SQL'),
      defaultPath: safeFilename(payload.name).replace(/\.drawdb\.json$/, `.${payload.extension}`),
      filters: [{ name: payload.extension.toUpperCase(), extensions: [payload.extension] }] });
    if (result.canceled || !result.filePath) return false;
    await atomicWrite(result.filePath, bytes); return true;
  });
});

function installMenu() {
  app.setAboutPanelOptions({ applicationName: 'ER Wiki', applicationVersion: APP_VERSION,
    copyright: 'Based on drawDB · AGPL-3.0', credits: tr('本地模型工作台，无云分享服务。') });
  Menu.setApplicationMenu(Menu.buildFromTemplate(localized([
    ...(process.platform === 'darwin' ? [{ label: 'ER Wiki', submenu: [
      { role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' },
      { role: 'unhide' }, { type: 'separator' }, { role: 'quit' },
    ] }] : []),
    { label: '文件', submenu: [
      { label: '导入模型副本…', accelerator: 'CmdOrCtrl+Shift+O', click: () => command('import') },
      { label: '导出当前模型 JSON…', accelerator: 'CmdOrCtrl+Shift+S', click: () => command('export') },
      { label: '设置…', accelerator: 'CmdOrCtrl+,', click: () => { window?.webContents.send('desktop:command', { action: 'settings' }); } },
      { type: 'separator' },
      { label: '打开桌面数据目录', click: () => shell.openPath(app.getPath('userData')) },
      { label: '存储与备份说明', click: () => dialog.showMessageBox(window, {
        type: 'info', message: tr('数据只保存在这台电脑'),
        detail: tr('模型保存在工作区；导出文件是独立快照。自动备份只备份已保存内容，恢复时创建副本。数据目录：{{v0}}', { v0: app.getPath('userData') }),
      }) },
      { type: 'separator' }, { role: process.platform === 'darwin' ? 'close' : 'quit' },
    ] },
    { label: '编辑', submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '视图', submenu: [
      { label: '重新载入', accelerator: 'CmdOrCtrl+R', click: async () => {
        if (await command('leave')) window?.webContents.reload();
      } },
      { role: 'togglefullscreen' },
      ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : []),
    ] },
    { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'front' }] },
    { label: '帮助', submenu: [{ label: '关于 ER Wiki', click: () => app.showAboutPanel() },
      { label: '使用说明', click: () => window?.webContents.send('desktop:command', { action: 'help' }) },
      { label: '下载与更新', click: () => shell.openExternal(RELEASES) },
      { label: '反馈问题', click: () => shell.openExternal('https://github.com/ztcshen/er-wiki/issues/new/choose') }] },
  ])));
}

function createWindow() {
  const bounds = state.bounds;
  const valid = bounds && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(bounds[k])) &&
    bounds.width >= 800 && bounds.height >= 600 && bounds.width < 10000 && bounds.height < 10000;
  const visible = valid && screen.getAllDisplays().some(({ workArea: a }) =>
    bounds.x + bounds.width > a.x + 80 && bounds.y + bounds.height > a.y + 80 &&
    bounds.x < a.x + a.width - 80 && bounds.y < a.y + a.height - 80);
  window = new BrowserWindow({
    width: 1440, height: 900, ...(visible ? bounds : {}), minWidth: 800, minHeight: 600,
    title: tr('ER Wiki · 数据模型工作台'), backgroundColor: '#f6f9fc', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false,
    },
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.on('page-title-updated', event => event.preventDefault());
  window.webContents.on('will-navigate', (event, url) => { if (!isAppURL(url)) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('render-process-gone', () => {
    for (const finish of pending.values()) finish(false);
    dialog.showMessageBox(window, localized({ type: 'error', message: '编辑器进程已停止',
      detail: '已保存的模型仍保留在桌面数据目录。请重新启动应用。', buttons: ['关闭应用'] }))
      .then(() => { mayClose = true; app.quit(); });
  });
  window.on('close', event => {
    if (mayClose) return;
    event.preventDefault();
    if (closePending) return;
    closePending = true;
    command('leave').then(async ok => {
      if (!ok) return;
      const route = new URL(window.webContents.getURL()).pathname;
      if (safeRoute(route)) state.route = route;
      state.bounds = window.getNormalBounds();
      await fs.promises.mkdir(app.getPath('userData'), { recursive: true });
      await atomicWrite(stateFile, JSON.stringify(state));
      await session.defaultSession.flushStorageData();
      mayClose = true;
      window.close();
    }).catch(error => dialog.showErrorBox(tr('未能安全关闭'), error.message))
      .finally(() => { closePending = false; });
  });
  window.on('closed', () => { window = null; });
  window.loadURL(ORIGIN + (safeRoute(state.route) ? state.route : '/editor/diagrams/demo-fulfillment'));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore();
    window?.show(); window?.focus();
  });
  app.whenReady().then(() => {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    const root = path.join(__dirname, 'dist');
    if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error('请先运行 npm run build');
    const permissionContext = (contents, details) => ({
      focused: Boolean(window?.isFocused() && contents === window.webContents),
      mainFrame: details.isMainFrame === true, url: details.requestingUrl,
    });
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) =>
      callback(allowsPermission(permission, permissionContext(contents, details))));
    session.defaultSession.setPermissionCheckHandler((contents, permission, origin, details) =>
      allowsPermission(permission, permissionContext(contents, { ...details, requestingUrl: details.requestingUrl || origin })));
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
      callback({ cancel: /^(https?|wss?|ftp):/i.test(details.url) });
    });
    // Monaco's AMD worker bootstrap needs eval; all scripts/assets remain local.
    const csp = "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
    protocol.handle('erwiki', async request => {
      if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      const file = assetPath(root, request.url);
      if (!file) return new Response('Forbidden', { status: 403 });
      try {
        const response = await net.fetch(pathToFileURL(file).href);
        const headers = new Headers(response.headers);
        headers.set('Content-Security-Policy', csp);
        headers.set('X-Content-Type-Options', 'nosniff');
        return new Response(response.body, { status: response.status, headers });
      } catch { return new Response('Not found', { status: 404 }); }
    });
    installMenu();
    createWindow();
  }).catch(error => { dialog.showErrorBox(tr('ER Wiki 启动失败'), error.message); app.quit(); });
}
app.on('window-all-closed', () => app.quit());
