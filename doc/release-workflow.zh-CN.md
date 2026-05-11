# Release Workflow Documentation

[English](release-workflow.md) | [simplified chinese](release-workflow.zh-CN.md)

## 概述

此 release workflow 使用 **GitHub Actions**、自定义 **releaser package**（`packages/releaser`）和 **Docker** 来自动化版本管理、changelog 生成、image builds 和 deployments。该 workflow 遵循完全由 **Conventional Commits** 驱动的 **Semantic Versioning（SemVer）**。

## Release Flow

### Summary
1. 创建 feature PR。
2. 确保所有 checks 都通过。
3. Rebase 并将 PR merge 到 `main`。
4. GitHub Actions 自动创建 GitHub release、构建 Docker images，并触发 deployment。

### 每次 push 到 `main` 时自动 Release

每次 push 到 `main`，只要修改了 `apps/**/*`、`packages/**/*` 或 `package-lock.json` 下的文件，都会触发 `all-release.yml` workflow。不需要手动步骤或 pre-release PR。

#### Step 1 – Detect Changed Apps

setup job 会检查 commit，找出哪些 `apps/*` 发生变化，然后将它们分为两类：

- **backends** – 非 Next.js apps（例如 `api`、`indexer`、`notifications`、`provider-proxy`、`tx-signer`）
- **nextjs** – Next.js apps（例如 `deploy-web`、`stats-web`）

#### Step 2 – Create GitHub Release

对于每个发生变化的 app，都会调用 `packages/releaser/recommended-bump.js`。它会：

1. 读取该 app path 自上一个 git tag 以来的所有 commits（包括本地 package dependencies）。
2. 根据 commit types 确定 SemVer bump level：
   - `BREAKING CHANGE` → **major**
   - `feat` / `feature` → **minor**
   - `fix`、`refactor`、`perf` → **patch**
   - `chore`、`docs`、`style`、`test` → no release
3. 根据可见 commit types（`feat`、`fix`、`refactor`、`perf`）生成 changelog。
4. 创建标记为 `<app-alias>/v<semver>` 的 GitHub release（例如 `console-api/v1.2.3`）。

用于 tags 的 app name aliases：

| Directory     | Tag prefix      |
|---------------|-----------------|
| `api`         | `console-api`   |
| `deploy-web`  | `console-web`   |
| others        | same as dir name|

如果未找到 releasable commits，则不会创建 release 或 build。

#### Step 3 – Build Docker Images

成功 release 后，`reusable-build-image.yml` 会构建 Docker images 并推送到 app 配置的 container registry。

- **Backends**：一个使用 `<semver>` tag 的 image。
- **Next.js apps**：两个 images：
  - `<semver>-beta` – 为 `staging` environment 构建。
  - `<semver>` – 为 `production` environment 构建。

`packages/docker/script/build.sh` 处理实际 build。如果相同 tag 的 image 已存在，它会跳过 rebuild。

#### Step 4 – Trigger Deployment

image build 完成后，release workflow 会自动 dispatch 该 app 的 deployment workflow（例如 `console-api-release.yml`），并携带 `cancel-if-stale=true`。如果已有更新版本排队或正在运行，这会跳过 deployment。

Deployment workflows 遵循以下模式（示例：`console-api-release.yml`）：
1. Deploy 到 **beta**（staging mainnet + sandbox）。
2. 对 beta environment 运行 **E2E tests**。
3. 如果 tests 通过，则 deploy 到 **production**（mainnet + sandbox）。

## Custom Scripts

build 和 deployment 过程中使用的 scripts 位于 `docker` package。详情请参阅 [packages/docker/README.md](../packages/docker/README.md)。

`packages/releaser` package 提供版本管理和 changelog 逻辑。
