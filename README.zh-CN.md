# ER Wiki

一个本地优先的数据库模型桌面工作台，基于 Electron、drawDB 和 ELK。
目前界面主要为中文，开源候选版与原有业务工作区使用不同的数据目录。

**当前仅整理到本地，未创建 GitHub 仓库、未推送、未发布 Release。**
计划使用账号/仓库：`ztcshen/er-wiki`。

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
未完成 Windows/Linux 发布验证及 Apple Developer ID 签名、公证。

代码许可证沿用上游的 [AGPL-3.0](LICENSE)，来源与第三方组件见
[NOTICE](NOTICE)。发布前还需完成[发布清单](docs/PUBLISH_CHECKLIST.md)；
仅构建成功不代表所有交互已经验收。
