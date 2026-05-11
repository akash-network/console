# Console Monorepo

[English](BUILD.md) | [simplified chinese](BUILD.zh-CN.md)

## 项目

- [Deploy](/apps/deploy-web/README.md) - Console 的 NextJS 前端
- [Stats](/apps/stats-web/README.md) - Stats 的 NextJS 前端
- [Api](/apps/api/README.md) - 主要的 Console API
- [Indexer](/apps/indexer/README.md) - 主要的 indexer 进程
- [Database](/packages/database/) - Database shared package
- [UI](/packages/ui/) - 共享的 UI 组件

## 创建 docker images

`./build.ps1 (web|api|indexer|notifications) [version] [-deploy]`

可以通过传入第二个参数或使用 `-version` 参数来设置 image version。如果未指定，它会从 `package.json` 中解析。

如果设置了 `-deploy` flag，vm instance 将更新到新版本。vm 重启期间会有约 2 分钟 downtime。**仅适用于 API。**

该脚本会使用当前用户的 docker username（从 `docker-credential-desktop list` 命令解析）。
