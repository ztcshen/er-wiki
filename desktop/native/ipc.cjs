const path = require("node:path");
const { MAX_FILE_BYTES, isAppURL, safeFilename } = require("../security.cjs");
const { atomicWrite, readModelFile } = require("../files.cjs");
const { checkUpdates, RELEASES } = require("../updates.cjs");

function registerDesktopIpc({
  ipcMain,
  app,
  dialog,
  shell,
  getWindow,
  preferences,
  backups,
  bridge,
  installMenu,
  tr,
  localized,
  nativeDialog,
  version: APP_VERSION,
}) {
  function trusted(event) {
    const window = getWindow();
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !isAppURL(event.senderFrame.url)
    ) {
      throw new Error("Untrusted desktop request");
    }
  }

  ipcMain.on("desktop:command-result", (event, result) => {
    try {
      trusted(event);
    } catch {
      return;
    }
    if (typeof result?.id === "string")
      bridge.settle(result.id, result.ok === true);
  });
  ipcMain.handle("desktop:request-close", (event) => {
    trusted(event);
    getWindow().close();
  });
  ipcMain.handle("desktop:confirm-leave", (event) => {
    trusted(event);
    return nativeDialog(async () => {
      const { response } = await dialog.showMessageBox(
        getWindow(),
        localized({
          type: "question",
          message: "当前模型有尚未保存的修改",
          detail: "保存到桌面工作区后继续？视角记忆不会代替模型保存。",
          buttons: ["保存并继续", "取消", "不保存"],
          defaultId: 0,
          cancelId: 1,
          noLink: true,
        }),
      );
      return ["save", "cancel", "discard"][response];
    });
  });
  ipcMain.handle("desktop:open-model", (event, kind = "json") => {
    trusted(event);
    if (!["json", "sql"].includes(kind))
      throw new Error("Invalid import format");
    return nativeDialog(async () => {
      const result = await dialog.showOpenDialog(
        getWindow(),
        localized({
          title: "导入模型副本（不覆盖已有模型）",
          properties: ["openFile"],
          filters: [
            {
              name: kind === "sql" ? "SQL DDL" : "drawDB JSON",
              extensions: kind === "sql" ? ["sql"] : ["json", "ddb"],
            },
          ],
        }),
      );
      if (result.canceled || !result.filePaths[0]) return null;
      return {
        name: path.basename(result.filePaths[0]),
        json: await readModelFile(result.filePaths[0]),
      };
    });
  });
  ipcMain.handle("desktop:export-model", (event, payload) => {
    trusted(event);
    if (
      typeof payload?.json !== "string" ||
      Buffer.byteLength(payload.json) > MAX_FILE_BYTES ||
      typeof payload.name !== "string" ||
      payload.name.length > 500
    )
      throw new Error("Invalid export");
    const data = JSON.parse(payload.json);
    if (!Array.isArray(data.tables) || !Array.isArray(data.relationships))
      throw new Error("Invalid model");
    return nativeDialog(async () => {
      const result = await dialog.showSaveDialog(
        getWindow(),
        localized({
          title: "导出当前模型 JSON",
          defaultPath: safeFilename(payload.name),
          filters: [{ name: "drawDB 模型", extensions: ["json"] }],
        }),
      );
      if (result.canceled || !result.filePath) return false;
      await atomicWrite(result.filePath, payload.json);
      return true;
    });
  });

  ipcMain.handle("desktop:get-preferences", (event) => {
    trusted(event);
    return {
      ...preferences.get(),
      version: APP_VERSION,
      platform: process.platform,
    };
  });
  ipcMain.handle("desktop:set-preferences", async (event, value) => {
    trusted(event);
    const result = await preferences.update(value);
    installMenu();
    getWindow()?.setTitle(tr("ER Wiki · 数据模型工作台"));
    return result;
  });
  ipcMain.handle(
    "desktop:create-backup",
    async (event, value, automatic = false) => {
      trusted(event);
      if (automatic && !preferences.get().autoBackup) return null;
      return backups.create(value, preferences.get().backupCount);
    },
  );
  ipcMain.handle("desktop:list-backups", (event, modelId) => {
    trusted(event);
    if (typeof modelId !== "string") throw new Error("Invalid model ID");
    return backups.list(modelId);
  });
  ipcMain.handle("desktop:read-backup", (event, id) => {
    trusted(event);
    return backups.read(id);
  });
  ipcMain.handle("desktop:check-updates", (event) => {
    trusted(event);
    return checkUpdates(APP_VERSION);
  });
  ipcMain.handle("desktop:open-resource", (event, resource) => {
    trusted(event);
    if (resource === "data") return shell.openPath(app.getPath("userData"));
    const links = {
      releases: RELEASES,
      feedback: "https://github.com/ztcshen/er-wiki/issues/new/choose",
      guide: "https://github.com/ztcshen/er-wiki/blob/main/docs/USER_GUIDE.md",
    };
    if (!Object.hasOwn(links, resource)) throw new Error("Unknown resource");
    return shell.openExternal(links[resource]);
  });
  ipcMain.handle("desktop:export-asset", async (event, payload) => {
    trusted(event);
    if (
      !payload ||
      !["svg", "png", "sql"].includes(payload.extension) ||
      typeof payload.name !== "string" ||
      payload.name.length > 500 ||
      typeof payload.content !== "string" ||
      Buffer.byteLength(payload.content) > MAX_FILE_BYTES * 4
    )
      throw new Error("Invalid export asset");
    const bytes =
      payload.extension === "png"
        ? Buffer.from(payload.content, "base64")
        : Buffer.from(payload.content);
    if (
      bytes.length > MAX_FILE_BYTES * 3 ||
      (payload.extension === "png" &&
        !bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")))
    )
      throw new Error("Invalid export content");
    return nativeDialog(async () => {
      const result = await dialog.showSaveDialog(getWindow(), {
        title: tr("导出图形或 SQL"),
        defaultPath: safeFilename(payload.name).replace(
          /\.drawdb\.json$/,
          `.${payload.extension}`,
        ),
        filters: [
          {
            name: payload.extension.toUpperCase(),
            extensions: [payload.extension],
          },
        ],
      });
      if (result.canceled || !result.filePath) return false;
      await atomicWrite(result.filePath, bytes);
      return true;
    });
  });
}
module.exports = { registerDesktopIpc };
