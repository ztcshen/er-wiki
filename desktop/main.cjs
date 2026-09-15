const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  protocol,
  net,
  session,
  shell,
  screen,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { ORIGIN, safeRoute, isAppURL } = require("./security.cjs");
const { atomicWrite } = require("./files.cjs");
const { createPreferences } = require("./preferences.cjs");
const { createBackupStore } = require("./backups.cjs");
const { createCommandBridge } = require("./native/command-bridge.cjs");
const { createModelHandoff } = require('./native/model-handoff.cjs');
const { registerDesktopIpc } = require("./native/ipc.cjs");
const { createLocalizer, createDialogQueue } = require("./native/dialogs.cjs");
const { installDesktopMenu } = require("./native/menu.cjs");
const { installSessionPolicy } = require("./native/session.cjs");
const APP_VERSION = require("./package.json").version;

app.setName("ER Wiki");
// Stable across upgrades and app locations, separate from every web browser.
app.setPath(
  "userData",
  process.env.ER_WIKI_TEST_PROFILE
    ? path.resolve(process.env.ER_WIKI_TEST_PROFILE)
    : path.join(app.getPath("appData"), "ER Wiki Community"),
);
protocol.registerSchemesAsPrivileged([
  {
    scheme: "erwiki",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let window;
let closePending = false;
let mayClose = false;
const bridge = createCommandBridge(() => window);
const command = (action) => bridge.request(action);
const stateFile = path.join(app.getPath("userData"), "window-state.json");
const handoff = createModelHandoff({ request: action => bridge.requestDetailed(action), writeResult: result =>
  atomicWrite(path.join(app.getPath('userData'), 'model-replacement-result.json'), JSON.stringify(result)) });
const preferences = createPreferences(
  path.join(app.getPath("userData"), "preferences.json"),
  () => app.getLocale(),
);
const backups = createBackupStore(
  path.join(app.getPath("userData"), "backups"),
);
const tr = (text, values) => preferences.tr(text, values);
const localized = createLocalizer(tr);
const nativeDialog = createDialogQueue(tr);
let state = {};
try {
  const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
    state = parsed;
} catch {
  /* First launch or damaged window metadata; model data is separate. */
}

function installMenu() {
  installDesktopMenu({
    app,
    Menu,
    dialog,
    shell,
    getWindow: () => window,
    command,
    tr,
    localized,
    version: APP_VERSION,
  });
}
registerDesktopIpc({
  ipcMain,
  app,
  dialog,
  shell,
  getWindow: () => window,
  preferences,
  backups,
  bridge,
  installMenu,
  tr,
  localized,
  nativeDialog,
  version: APP_VERSION,
  onWorkspaceReady: modelId => handoff.ready(modelId),
});

function createWindow() {
  const bounds = state.bounds;
  const valid =
    bounds &&
    ["x", "y", "width", "height"].every((k) => Number.isFinite(bounds[k])) &&
    bounds.width >= 800 &&
    bounds.height >= 600 &&
    bounds.width < 10000 &&
    bounds.height < 10000;
  const visible =
    valid &&
    screen
      .getAllDisplays()
      .some(
        ({ workArea: a }) =>
          bounds.x + bounds.width > a.x + 80 &&
          bounds.y + bounds.height > a.y + 80 &&
          bounds.x < a.x + a.width - 80 &&
          bounds.y < a.y + a.height - 80,
      );
  window = new BrowserWindow({
    width: 1440,
    height: 900,
    ...(visible ? bounds : {}),
    minWidth: 800,
    minHeight: 600,
    title: tr("ER Wiki · 数据模型工作台"),
    backgroundColor: "#f6f9fc",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.on("page-title-updated", (event) =>
    event.preventDefault(),
  );
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAppURL(url)) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("render-process-gone", () => {
    bridge.cancelAll();
    dialog
      .showMessageBox(
        window,
        localized({
          type: "error",
          message: "编辑器进程已停止",
          detail: "已保存的模型仍保留在桌面数据目录。请重新启动应用。",
          buttons: ["关闭应用"],
        }),
      )
      .then(() => {
        mayClose = true;
        app.quit();
      });
  });
  window.on("close", (event) => {
    if (mayClose) return;
    event.preventDefault();
    if (closePending) return;
    closePending = true;
    command("leave")
      .then(async (ok) => {
        if (!ok) return;
        const route = new URL(window.webContents.getURL()).pathname;
        if (safeRoute(route)) state.route = route;
        state.bounds = window.getNormalBounds();
        await fs.promises.mkdir(app.getPath("userData"), { recursive: true });
        await atomicWrite(stateFile, JSON.stringify(state));
        await session.defaultSession.flushStorageData();
        mayClose = true;
        window.close();
      })
      .catch((error) => dialog.showErrorBox(tr("未能安全关闭"), error.message))
      .finally(() => {
        closePending = false;
      });
  });
  window.on("closed", () => {
    window = null;
  });
  window.loadURL(
    ORIGIN +
      (safeRoute(state.route)
        ? state.route
        : "/editor/diagrams/demo-fulfillment"),
  );
}

if (!app.requestSingleInstanceLock({ argv: process.argv, cwd: process.cwd() })) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv, cwd, data) => {
    handoff.enqueue(Array.isArray(data?.argv) ? data.argv : argv, typeof data?.cwd === 'string' ? data.cwd : cwd)
      .catch(error => dialog.showErrorBox(tr('模型替换失败'), error.message));
    if (window?.isMinimized()) window.restore();
    window?.show();
    window?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      fs.mkdirSync(app.getPath("userData"), { recursive: true });
      const root = path.join(__dirname, "dist");
      if (!fs.existsSync(path.join(root, "index.html")))
        throw new Error("请先运行 npm run build");
      installSessionPolicy({
        session,
        protocol,
        net,
        root,
        getWindow: () => window,
      });
      installMenu();
      createWindow();
      await handoff.enqueue(process.argv, process.cwd());
    })
    .catch((error) => {
      dialog.showErrorBox(tr("ER Wiki 启动失败"), error.message);
      app.quit();
    });
}
app.on("window-all-closed", () => app.quit());
