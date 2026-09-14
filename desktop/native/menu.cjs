const { RELEASES } = require("../updates.cjs");

function installDesktopMenu({
  app,
  Menu,
  dialog,
  shell,
  getWindow,
  command,
  tr,
  localized,
  version: APP_VERSION,
}) {
  app.setAboutPanelOptions({
    applicationName: "ER Wiki",
    applicationVersion: APP_VERSION,
    copyright: "Based on drawDB · AGPL-3.0",
    credits: tr("本地模型工作台，无云分享服务。"),
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      localized([
        ...(process.platform === "darwin"
          ? [
              {
                label: "ER Wiki",
                submenu: [
                  { role: "about" },
                  { type: "separator" },
                  { role: "hide" },
                  { role: "hideOthers" },
                  { role: "unhide" },
                  { type: "separator" },
                  { role: "quit" },
                ],
              },
            ]
          : []),
        {
          label: "文件",
          submenu: [
            { label: '完整替换当前模型…', click: () => command('replace') },
            {
              label: "导入模型副本…",
              accelerator: "CmdOrCtrl+Shift+O",
              click: () => command("import"),
            },
            {
              label: "导出当前模型 JSON…",
              accelerator: "CmdOrCtrl+Shift+S",
              click: () => command("export"),
            },
            {
              label: "设置…",
              accelerator: "CmdOrCtrl+,",
              click: () => {
                getWindow()?.webContents.send("desktop:command", {
                  action: "settings",
                });
              },
            },
            {
              label: "快速查找…",
              accelerator: "CmdOrCtrl+K",
              click: () => {
                getWindow()?.webContents.send("desktop:command", {
                  action: "palette",
                });
              },
            },
            { type: "separator" },
            {
              label: "打开桌面数据目录",
              click: () => shell.openPath(app.getPath("userData")),
            },
            {
              label: "存储与备份说明",
              click: () =>
                dialog.showMessageBox(getWindow(), {
                  type: "info",
                  message: tr("数据只保存在这台电脑"),
                  detail: tr(
                    "模型保存在工作区；导出文件是独立快照。自动备份只备份已保存内容，恢复时创建副本。数据目录：{{v0}}",
                    { v0: app.getPath("userData") },
                  ),
                }),
            },
            { type: "separator" },
            { role: process.platform === "darwin" ? "close" : "quit" },
          ],
        },
        {
          label: "编辑",
          submenu: [
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
          ],
        },
        {
          label: "视图",
          submenu: [
            {
              label: "重新载入",
              accelerator: "CmdOrCtrl+R",
              click: async () => {
                if (await command("leave")) getWindow()?.webContents.reload();
              },
            },
            { role: "togglefullscreen" },
            ...(!app.isPackaged ? [{ role: "toggleDevTools" }] : []),
          ],
        },
        {
          label: "窗口",
          submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }],
        },
        {
          label: "帮助",
          submenu: [
            { label: "关于 ER Wiki", click: () => app.showAboutPanel() },
            {
              label: "使用说明",
              click: () =>
                getWindow()?.webContents.send("desktop:command", {
                  action: "help",
                }),
            },
            { label: "下载与更新", click: () => shell.openExternal(RELEASES) },
            {
              label: "反馈问题",
              click: () =>
                shell.openExternal(
                  "https://github.com/ztcshen/er-wiki/issues/new/choose",
                ),
            },
          ],
        },
      ]),
    ),
  );
}

module.exports = { installDesktopMenu };
