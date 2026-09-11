const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, session, shell, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { ORIGIN, MAX_FILE_BYTES, isAppURL, assetPath, safeRoute, safeFilename, allowsPermission } = require('./security.cjs');
const { atomicWrite, readModelFile } = require('./files.cjs');

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
  if (busyDialog) throw new Error('请先关闭当前文件对话框');
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
    const { response } = await dialog.showMessageBox(window, {
      type: 'question', message: '当前模型有尚未保存的修改',
      detail: '保存到桌面工作区后继续？视角记忆不会代替模型保存。',
      buttons: ['保存并继续', '取消', '不保存'], defaultId: 0, cancelId: 1,
      noLink: true,
    });
    return ['save', 'cancel', 'discard'][response];
  });
});
ipcMain.handle('desktop:open-model', event => {
  trusted(event);
  return nativeDialog(async () => {
    const result = await dialog.showOpenDialog(window, {
      title: '导入模型副本（不覆盖已有模型）', properties: ['openFile'],
      filters: [{ name: 'drawDB 模型', extensions: ['json', 'ddb'] }],
    });
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
    const result = await dialog.showSaveDialog(window, {
      title: '导出当前模型 JSON', defaultPath: safeFilename(payload.name),
      filters: [{ name: 'drawDB 模型', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return false;
    await atomicWrite(result.filePath, payload.json);
    return true;
  });
});

function installMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ label: 'ER Wiki', submenu: [
      { role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' },
      { role: 'unhide' }, { type: 'separator' }, { role: 'quit' },
    ] }] : []),
    { label: '文件', submenu: [
      { label: '导入模型副本…', accelerator: 'CmdOrCtrl+Shift+O', click: () => command('import') },
      { label: '导出当前模型 JSON…', accelerator: 'CmdOrCtrl+Shift+S', click: () => command('export') },
      { type: 'separator' },
      { label: '打开桌面数据目录', click: () => shell.openPath(app.getPath('userData')) },
      { label: '存储与备份说明', click: () => dialog.showMessageBox(window, {
        type: 'info', message: '数据只保存在这台电脑',
        detail: `桌面工作区与 Chrome 数据独立。浏览器的修改请先导出 JSON，再导入为副本。\n\n模型修改遵循自动保存开关；平移缩放只记视角。导出文件是独立快照，不会随编辑自动更新。\n\n数据目录：${app.getPath('userData')}`,
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
    { label: '帮助', submenu: [{ label: '关于 ER Wiki', click: () => app.showAboutPanel() }] },
  ]));
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
    title: 'ER Wiki · 数据模型工作台', backgroundColor: '#f6f9fc', show: false,
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
    dialog.showMessageBox(window, { type: 'error', message: '编辑器进程已停止',
      detail: '已保存的模型仍保留在桌面数据目录。请重新启动应用。', buttons: ['关闭应用'] })
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
    }).catch(error => dialog.showErrorBox('未能安全关闭', error.message))
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
    app.setAboutPanelOptions({ applicationName: 'ER Wiki', applicationVersion: app.getVersion(),
      copyright: 'Based on drawDB · AGPL-3.0', credits: '本地模型工作台，无云分享服务。' });
    installMenu();
    createWindow();
  }).catch(error => { dialog.showErrorBox('ER Wiki 启动失败', error.message); app.quit(); });
}
app.on('window-all-closed', () => app.quit());
