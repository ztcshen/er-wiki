# ER Wiki

一个本地优先的数据库模型桌面工作台，基于 Electron、drawDB 和 ELK。
支持简体中文、English 和跟随系统，切换语言不会改写模型内容。
社区版与原有业务工作区使用不同的数据目录。

**当前为社区预览版。**
[GitHub 仓库](https://github.com/ztcshen/er-wiki) ·
[下载与发布说明](https://github.com/ztcshen/er-wiki/releases) ·
[CI 状态](https://github.com/ztcshen/er-wiki/actions/workflows/ci.yml)

当前源码版本为 `0.2.0-preview.1`，本地完成不代表已发布新安装包；下载以 Releases 为准。

## 桌面工作流

- 统一设置：语言、主题、自动保存、备份保留数量与手动检查更新。
- 按模型恢复领域、选中表、缩放平移；支持阅读书签和返回上次位置。
- 搜索表、字段、别名、注释及枚举解释。
- 修改显示名称、说明和枚举不重排整图；结构变化重新布局。
- SQL 本机解析预览后导入新模型；JSON 带版本号并兼容旧文件。
- 自动或手动本地备份，恢复为副本；SVG / PNG 导出当前视图、领域或完整总图。

详见[使用说明](docs/USER_GUIDE.md)和[安装、签名与公证说明](docs/DESKTOP_RELEASE.md)。

## 电商履约示例

示例独立虚构，不来自真实业务数据库。13 张表覆盖：

- 商品、仓库及库存；
- 订单明细与库存占用；
- 分仓履约、包裹及部分发货；
- 退货申请、退货明细与入库处置。

![电商履约 ER 示例](docs/images/fulfillment.svg)

可直接查看 [DDL](examples/fulfillment.sql)、
[模型 JSON](examples/fulfillment.drawdb.json) 和[阅读说明](examples/README.md)。
不包含客户、地址、订单等实际业务记录。

## 本机构建

```sh
npm ci
npm run setup
npm run scan
npm run build
npm start
```

需要 Git、Node.js 22.18+。使用 `npm run package` 打包当前平台，
安装包放在 `desktop/release/`。当前优先准备 macOS 预览包，
Windows/Linux 尚未发布验证。默认包使用临时签名；Developer ID 签名、公证入口
已提供，需要维护者自己的证书与凭据才能执行。

代码许可证沿用上游的 [AGPL-3.0](LICENSE)，来源与第三方组件见
[NOTICE](NOTICE)。发布前还需完成[发布清单](docs/PUBLISH_CHECKLIST.md)；
仅构建成功不代表所有交互已经验收。
