const repo='https://github.com/ztcshen/er-wiki';
const origin='https://ztcshen.github.io/er-wiki/';
const copy={
  en:{lang:'en',title:'Readable ER diagrams for complex database schemas.',
    description:'EDA-style orthogonal routing, shared buses and obstacle avoidance for database relationships. Explore ER Wiki, an open-source ER diagram workbench.',
    eyebrow:'EDA-style routing for database relationships',
    intro:'ER Wiki applies orthogonal routing, shared buses, and obstacle avoidance to database relationships — helping growing schemas stay navigable instead of turning into spaghetti.',
    try:'Try Live Demo',github:'View on GitHub',download:'Desktop download',language:'中文',other:'zh.html',
    tags:['Offline-first desktop','AGPL-3.0','Local SQL import','No application telemetry'],
    caption:'Actual ER Wiki web renderer · fictional fulfillment schema · 13 tables / 19 relationships',
    visual:'Follow the wire, not a wall of lines.',hint:'Open the demo. Hover to trace a relationship; double-click a wire to read its meaning.',
    problem:'When ER diagrams become spaghetti',problemText:'Small schemas are easy to visualize. As more tables share keys and cross business domains, finding the relationship you need becomes harder than drawing it.',
    solution:'Route relationships like circuits',solutionText:'Circuit-design tools have dealt with dense connectivity for decades. ER Wiki borrows that perspective: organize paths, shared connections and reading scopes — not just the table positions.',
    why:'Why EDA-style routing?',whyText:'Database schemas and circuit schematics share a visualization problem: many nodes, many connections, limited 2D space. ER Wiki focuses on how relationships are routed as well as what they connect.',
    mechanisms:[['01 / Paths','Orthogonal routing + obstacle avoidance','ELK places the graph; libavoid reroutes eligible candidates around table obstacles.'],['02 / Connections','Shared buses + high-fanout junctions','Related references can share a trunk. Select an individual relationship without losing its original endpoints.'],['03 / Ports','Four-sided connection ports','Ports can use all four table sides while retaining field identity and 1/N cardinality.']],
    proof:'This is ER Wiki’s own output, not a fabricated before/after comparison. The 13-table example demonstrates the interaction, not a large-schema benchmark.',
    capabilities:'Read the whole schema. Inspect one relationship.',
    features:[['Navigate by scope','Overview → domain → table → column. Search, a minimap and focused tracing help keep your place.'],['Read the meaning','Inspect fields, enums, cardinality and recorded evidence. A drawn logical relationship is not automatically a database foreign key.'],['Work on your model','Desktop: import SQL locally, edit tables and relations, round-trip JSON, export SVG/PNG. The web demo is read-only.']],
    privacy:'Local work, without a hosted account',privacyText:'The installed Electron app works offline with local models. No application telemetry or automatic model uploads. Update checks contact GitHub only when requested; the hosted demo still uses normal web requests.',
    architecture:'Built on existing tools, not a new diagram engine',architectureText:'drawDB provides the editing foundation. ELK handles layout and compaction; libavoid handles obstacle routing. React renders the workspace, and Electron packages the desktop app.',
    limits:'An engineering trade-off, not a perfect-layout promise',limitsText:'Layout is a bounded heuristic search. Dense diagrams can still have conflicts; degraded results are reported instead of cached as successful. No 50/100/200-table performance guarantee, automatic business inference or workflow engine is claimed.',
    source:'Read the implementation',limitLink:'Known limitations',end:'Bring a schema that no longer fits on a whiteboard.',endText:'Start with the fictional example. Use the desktop app for your own SQL and JSON models.',platform:'Published binary: macOS Apple Silicon. Ad-hoc signed, not notarized. Windows/Linux releases are not validated.',alt:'ER Wiki fulfillment ER diagram with orthogonal relationship lines, shared junctions and domain navigation',footer:'Open source · No sign-in to explore · No analytics scripts on this page'},
  zh:{lang:'zh-CN',title:'让复杂数据库 Schema 的 ER 图保持可读。',
    description:'ER Wiki 借鉴 EDA / 电路布线思想，用正交布线、避障、四边端口和共享总线组织数据库关系。开源、本地优先的 ER 图工作台。',
    eyebrow:'把 EDA 布线思想带到数据库关系图',
    intro:'借鉴 EDA / 电路布线思想，对数据库关系进行正交布线、避障和共享总线组织。表与关系不断增加时，仍能找到要看的那条线。',
    try:'打开在线 Demo',github:'查看 GitHub',download:'下载桌面版',language:'English',other:'index.html',
    tags:['桌面离线优先','AGPL-3.0 开源','SQL 本机导入','无应用遥测'],
    caption:'ER Wiki Web 渲染器真实截图 · 虚构电商履约模型 · 13 张表 / 19 条关系',
    visual:'看清一条关系，而不是面对一团线。',hint:'打开 demo，悬停追踪关系，双击连线查看字段映射和关联说明。',
    problem:'当 ER 图变成一团线',problemText:'小型 Schema 很容易画。随着更多表共享关联字段、关系跨越业务领域，找到一条关系往往比把它画出来更难。',
    solution:'像电路一样组织关系线',solutionText:'电路设计工具长期面对密集连接。ER Wiki 借鉴这种思路：不仅安排表的位置，也关注连线的路径、共享连接和阅读范围。',
    why:'为什么借鉴 EDA 布线？',whyText:'数据库 Schema 与电路原理图有一个相似的可视化难题：节点多、连接多，而二维空间有限。ER Wiki 不只展示“谁关联谁”，也关注“这条关系怎么走”。',
    mechanisms:[['01 / 路径','正交布线与避障','ELK 安排图布局，libavoid 对适用候选绕开表卡片重新布线。'],['02 / 连接','共享总线与高扇出汇聚点','共享引用可以合并为干线；仍可追踪其中一条关系，保留原始端点。'],['03 / 端口','表的四边都能连线','端口可分布在四边，同时保留字段身份与 1/N 基数，不靠改关系语义来整理画面。']],
    proof:'这里展示的是 ER Wiki 自己的真实输出，不是伪造的优化前后对比。13 表示例用于体验交互，不代表大型 Schema 性能测试。',
    capabilities:'先看全局，再读一条关系。',
    features:[['逐层阅读','总图 → 领域 → 表 → 字段。结合搜索、小地图和关系追踪，保留阅读位置。'],['理解关联含义','查看字段、枚举、基数和已有依据。逻辑关系画在图上，不等于数据库已经存在外键。'],['维护自己的模型','桌面版支持本机解析 SQL、编辑表和关系、JSON 导入导出以及 SVG/PNG 导出。在线 demo 只读。']],
    privacy:'本机工作，不需要云端账号',privacyText:'安装后的 Electron 应用可离线处理本地模型，无应用遥测，不自动上传模型。只有主动检查更新时才访问 GitHub；在线 demo 仍需要正常的网页请求。',
    architecture:'复用成熟工具，不另造绘图引擎',architectureText:'drawDB 提供编辑基础；ELK 负责布局与压缩；libavoid 负责避障布线；React 渲染工作台；Electron 提供桌面应用。',
    limits:'是工程取舍，不是完美布局承诺',limitsText:'布局采用有预算限制的启发式搜索。密集图仍可能出现冲突，不可读的结果会明确提示，不作为成功布局缓存。不承诺 50/100/200 表性能，不自动推断业务事实，也不是流程执行引擎。',
    source:'查看实现与设计',limitLink:'已知限制',end:'当你的 Schema 已经画不进一块白板。',endText:'先用虚构示例体验，再用桌面版打开自己的 SQL 和 JSON 模型。',platform:'已发布安装包：macOS Apple Silicon。临时签名，未做 Apple 公证；Windows/Linux 发布尚未验证。',alt:'ER Wiki 电商履约 ER 图：正交关系线、共享汇聚点和业务领域导航',footer:'开源 · 体验无需登录 · 此页面没有分析追踪脚本'}
};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
export function landingHTML(language='en'){
 const c=copy[language],url=origin+(language==='zh'?'zh.html':'');
 const cards=items=>items.map(([a,b,d])=>d?`<article><span class="eyebrow">${esc(a)}</span><h3>${esc(b)}</h3><p>${esc(d)}</p></article>`:`<article><h3>${esc(a)}</h3><p>${esc(b)}</p></article>`).join('');
 return `<!doctype html><html lang="${c.lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ER Wiki — ${esc(c.title)}</title><meta name="description" content="${esc(c.description)}">
<meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'self'; form-action 'none'; object-src 'none'">
<link rel="canonical" href="${url}"><link rel="alternate" hreflang="en" href="${origin}"><link rel="alternate" hreflang="zh-CN" href="${origin}zh.html"><link rel="alternate" hreflang="x-default" href="${origin}">
<meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:site_name" content="ER Wiki"><meta property="og:locale" content="${language==='zh'?'zh_CN':'en_US'}"><meta property="og:title" content="ER Wiki — ${esc(c.title)}"><meta property="og:description" content="${esc(c.description)}"><meta property="og:image" content="${origin}social-preview.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(c.alt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="ER Wiki — ${esc(c.title)}"><meta name="twitter:description" content="${esc(c.description)}"><meta name="twitter:image" content="${origin}social-preview.png">
<link rel="icon" href="./icon.svg" type="image/svg+xml"><link rel="stylesheet" href="./landing.css"></head><body>
<a class="skip" href="#content">${language==='zh'?'跳至正文':'Skip to content'}</a>
<header class="nav"><a class="brand" href="./"><img src="./icon.svg" width="28" height="28" alt="">ER Wiki</a><nav aria-label="${language==='zh'?'网站导航':'Site navigation'}"><a href="#routing">EDA × Database</a><a href="${repo}">GitHub ↗</a><a href="./${c.other}" lang="${language==='zh'?'en':'zh-CN'}">${c.language}</a></nav></header>
<main id="content"><section class="hero"><p class="eyebrow">${c.eyebrow}</p><h1>${c.title}</h1><p class="intro">${c.intro}</p><div class="actions"><a class="primary" href="./demo.html">${c.try} <span aria-hidden="true">↗</span></a><a class="secondary" href="${repo}">${c.github}</a><a href="${repo}/releases/latest">${c.download} →</a></div><ul class="tags">${c.tags.map(t=>`<li>${t}</li>`).join('')}</ul></section>
<figure class="hero-visual"><a href="./demo.html" aria-label="${c.try}"><img src="./routing-preview.png" width="1440" height="900" alt="${c.alt}" fetchpriority="high"></a><figcaption>${c.caption}</figcaption></figure>
<div class="visual-note"><strong>${c.visual}</strong><span>${c.hint}</span></div>
<section class="problem two"><article><h2>${c.problem}</h2><p>${c.problemText}</p></article><article><h2>${c.solution}</h2><p>${c.solutionText}</p></article></section>
<section id="routing"><p class="eyebrow">EDA × Database</p><h2>${c.why}</h2><p class="section-intro">${c.whyText}</p><div class="three">${cards(c.mechanisms)}</div><p class="proof">${c.proof}</p></section>
<section><h2>${c.capabilities}</h2><div class="three">${cards(c.features)}</div></section>
<section class="two"><article><h2>${c.privacy}</h2><p>${c.privacyText}</p></article><article><h2>${c.architecture}</h2><p>${c.architectureText}</p><a href="${repo}/blob/main/docs/WORKBENCH_DESIGN.md">${c.source} →</a></article></section>
<aside class="limits"><h2>${c.limits}</h2><p>${c.limitsText}</p><a href="${repo}/blob/main/docs/KNOWN_LIMITATIONS.md">${c.limitLink} →</a></aside>
<section class="closing"><h2>${c.end}</h2><p>${c.endText}</p><div class="actions"><a class="primary" href="./demo.html">${c.try} ↗</a><a href="${repo}">${c.github} →</a></div><small>${c.platform}</small></section></main>
<footer><span>ER Wiki · ${c.footer}</span><a href="./LICENSE.txt">AGPL-3.0</a><a href="./THIRD_PARTY.txt">Credits</a></footer></body></html>`;
}
