# Desktop guide / 桌面使用说明

## Start / 开始

Open the fictional fulfillment model or choose **More → Import JSON / Import SQL**.
SQL is parsed on this computer, not executed against a database. Select the SQL
dialect, preview the parsed tables and relations, then import as a new model.
Unsupported SQL syntax may fail or need manual reconciliation; check the preview.

可以直接阅读虚构电商履约示例，也可以从“更多”导入 JSON 或 SQL。
SQL 只在本机解析，不连接数据库、不执行语句。选择方言并核对解析预览后再导入。
导入和复制始终生成新模型，不覆盖已有模型。尚未发布的源码功能不代表旧安装包也具备。

## Language and appearance / 语言与外观

**More → Settings**, or **⌘/Ctrl + ,**, opens the unified settings.
Choose System default, 简体中文 or English. The interface, native menus and dialogs
follow this choice. Field names, aliases, comments, group names and enum meanings
are user-authored model content and are deliberately not translated.

“更多 → 设置”中切换语言、深浅色、自动保存和自动备份。语言立即生效并在重启后保留。
示例中的中文分组及字段解释属于模型内容，英文界面仍保留原文。可在字段详情中编辑“显示名称”。

## Read / 阅读

- **All tables** includes every table, including isolated tables.
- **Domain overview** summarizes domains; open one to inspect its tables.
- **Related tables** and **All fields** inspect a table and its neighboring relations.
- Search matches table/field names, aliases, comments and enum values/meanings.
- Drag the background to pan; scroll or use the controls to zoom.
- Bookmark a reading position with a descriptive name; use Back to return to the
  previous position. Deleted targets fall back safely to the overview.

总图、领域、表和字段可以逐层查看。平移缩放、选择对象和书签按模型独立记忆，
切换模型或重启后恢复，不会更新模型保存时间。书签最多 50 个，视图缓存最多 60 个。
书签保存在这台电脑，不随模型 JSON 导出；这避免把个人阅读习惯混入共享模型。

Bus / Hub aggregates references; identical Net Labels identify one logical net.
Click to inspect original members and evidence. Dashed wires need verification;
solid wires are not automatically database foreign keys. Text and color edits
refresh presentation without moving nodes. Structural edits and Arrange rerun ELK.

共享引用可以合并为 Bus / Hub，长线可用同名 Net Label 表示。点击关系查看原始成员和依据。
修改注释、字段别名、类型显示或枚举解释不会重排整图；增删表、改变关联和分组结构才触发布局。

## Save and recover / 保存与恢复

| Action / 操作 | Meaning / 含义 |
|---|---|
| Save / 保存 | Commit model content to this local workspace / 保存模型到本机工作区 |
| Remember view / 记忆视角 | Independent reading state, not a model edit / 不属于模型修改 |
| Export JSON / 导出 | Independent snapshot; later edits do not update the file / 独立快照 |
| Automatic backup / 自动备份 | Saved records only; same content is deduplicated / 只备份已保存内容 |
| Manual backup / 手动备份 | Includes current edits / 包含当前尚未保存的编辑 |
| Restore / 恢复 | New copy; original remains untouched / 新建副本，不覆盖原件 |

Choose **More → Backup and restore**. Backups are stored in the application's
local data folder, which can be opened from Settings. Retention is 10, 20 or 50
snapshots per model, with an overall limit of 200. A successful new backup may
remove older backups above those limits. These are not off-device backups;
export JSON to your own backup location for disaster recovery.

新格式含 `format: "er-wiki"` 和 `schemaVersion: 1`。旧 drawDB JSON 仍可导入。
遇到高于当前支持版本的文件会拒绝导入并提示升级，不会尝试破坏性降级。

## Export / 导出

**More → Export ER diagram** offers SVG, PNG and PNG-to-clipboard. Choose the
current viewport, current domain or full overview. Output excludes toolbars and
does not navigate the workspace. SVG preserves scalable geometry; PNG is capped
at 8192 pixels per side and approximately 24 million pixels to limit memory use.

“导出 ER 图”支持当前视图、当前领域或全部表总图；纯图导出不带工具按钮，也不改变阅读位置。
大图优先选择 SVG。SQL 导出沿用上游能力，结果应人工检查，不会自动执行到数据库。

## Updates and feedback / 更新与反馈

Settings checks GitHub only when you click **Check for updates**. No model data
is sent. Download and install are manual; no silent update runs in the background.
Feedback opens the public issue form without attaching model content or local paths.

设置中的“检查更新”只在点击时联网。下载更新需要手动进行；反馈问题也不会自动上传模型。
敏感资料请自行脱敏，勿放入公开 Issue。安装限制见 [Desktop release](DESKTOP_RELEASE.md)。
