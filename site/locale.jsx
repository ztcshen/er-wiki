import { useSyncExternalStore } from "react";
import desktopMessages from "../desktop/i18n/messages.json";

const messages = {
  ...desktopMessages,
  在线体验: "Live demo",
  只读示例: "Read-only demo",
  电商履约: "Commerce fulfillment",
  "虚构结构 · 无业务数据": "Fictional schema · No business records",
  下载桌面版: "Download desktop",
  切换主题: "Switch theme",
  界面语言: "Interface language",
  总图: "Overview",
  领域: "Domains",
  关系追踪: "Trace relationships",
  关闭目录: "Close directory",
  查看字段与关系: "Inspect fields and relationships",
  "共 13 张表 · 4 个领域": "13 tables · 4 domains",
  "点击表或连线，开始探索。": "Select a table or relationship to explore.",
  "完整编辑、导入与保存请使用桌面版。":
    "Use the desktop app to edit, import and save models.",
  阅读提示: "How to explore",
  "鼠标拖动平移，滚轮缩放。手机可单指拖动，使用加减按钮缩放。":
    "Drag to pan; scroll to zoom. On a phone, drag with one finger and use the zoom buttons.",
  "在线示例只提供结构阅读；不连接数据库，不上传输入。":
    "This demo reads a fixed schema only. It does not connect to a database or upload your input.",
  "布局加载失败，请重试。": "Could not load the diagram. Please retry.",
  "正在载入示例…": "Loading the demo…",
  已选择的表: "Selected table",
  图例: "Legend",
  "完整总图保留全部表；放大后可阅读字段。":
    "The overview keeps every table. Zoom in to read fields.",
  已显示: "Showing",
  返回总图: "Back to overview",
  结构阅读: "Explore schema",
};
const requestedLanguage=typeof location!=='undefined'?new URLSearchParams(location.search).get('lang'):null;
let language = requestedLanguage==='en'?'en':requestedLanguage==='zh'?'zh':
  typeof navigator !== "undefined" && /^zh/i.test(navigator.language)
    ? "zh"
    : "en";
const listeners = new Set();
export const tr = (key, values = {}) =>
  (language === "en" ? messages[key] || key : key).replace(
    /\{\{(\w+)\}\}/g,
    (_, name) => String(values[name] ?? ""),
  );
export function setLanguage(value) {
  language = value === "zh" ? "zh" : "en";
  document.documentElement.lang = language;
  listeners.forEach((listener) => listener());
}
export function useLocale() {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => language,
  );
  return { language: current, setLanguage };
}
