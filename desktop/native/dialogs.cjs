function createLocalizer(tr) {
  return function localized(value) {
    if (Array.isArray(value))
      return value.map((v) => (typeof v === "string" ? tr(v) : localized(v)));
    if (!value || typeof value !== "object") return value;
    const roles = {
      about: "关于 ER Wiki",
      hide: "隐藏 ER Wiki",
      hideOthers: "隐藏其他应用",
      unhide: "显示全部",
      quit: "退出 ER Wiki",
      close: "关闭窗口",
      cut: "剪切",
      copy: "复制",
      paste: "粘贴",
      selectAll: "全选",
      togglefullscreen: "切换全屏",
      toggleDevTools: "开发者工具",
      minimize: "最小化",
      zoom: "缩放窗口",
      front: "全部置于前台",
    };
    if (value.role && !value.label && roles[value.role])
      value = { ...value, label: roles[value.role] };
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        ["label", "title", "message", "detail"].includes(key) &&
        typeof item === "string"
          ? tr(item)
          : localized(item),
      ]),
    );
  };
}
function createDialogQueue(tr) {
  let busyDialog = false;
  return async function nativeDialog(work) {
    if (busyDialog) throw new Error(tr("请先关闭当前文件对话框"));
    busyDialog = true;
    try {
      return await work();
    } finally {
      busyDialog = false;
    }
  };
}
module.exports = { createLocalizer, createDialogQueue };
