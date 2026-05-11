# 贡献指南

[English](CLAUDE.md) | [simplified chinese](CLAUDE.zh-CN.md)

本文件汇总了所有已落地的 RFC（Request for Comments）贡献指南。

## 项目总体说明

这是一个使用 **npm workspaces** 的 **monorepo** 项目。所有项目都使用 **strict TypeScript** 配置（所有 `tsconfig.json` 文件中均为 `"strict": true`），从而确保整个代码库的类型安全。

### 项目结构

该 monorepo 包含多个应用和 shared packages：

**Applications：**
- `apps/api` - 使用 tsyringe DI 的 Hono + OpenAPI REST API
- `apps/deploy-web` - 用于在 Akash Network 上部署的 Next.js 前端
- `apps/stats-web` - 用于网络统计信息的 Next.js 前端
- `apps/indexer` - Node.js blockchain indexer（Express，无 DI）
- `apps/notifications` - 用于处理通知的 NestJS 服务（NestJS 内置 DI）
- `apps/log-collector` - 独立的 log collector（vanilla Node.js + tsyringe）
- `apps/provider-proxy` - 用于代理发往 providers 请求的 Hono 服务（manual factory DI）
- `apps/provider-console` - Provider console application
- `apps/tx-signer` - 内部交易签名服务（Hono + tsyringe）

**Shared Packages：**
- `packages/database` - Database shared package（Drizzle ORM schemas）
- `packages/dev-config` - 共享 ESLint、TypeScript 和 Prettier configs
- `packages/docker` - Docker build utilities
- `packages/env-loader` - 环境变量加载（使用 `@dotenvx/dotenvx`）
- `packages/http-sdk` - HTTP client SDK
- `packages/instrumentation` - OpenTelemetry instrumentation setup
- `packages/logging` - Logging utilities（基于 Pino 的 `LoggerService`）
- `packages/net` - Blockchain Network utilities
- `packages/network-store` - Network state management
- `packages/react-query-proxy` - React Query wrapper utilities
- `packages/react-query-sdk` - 面向 console services 的 React Query SDK
- `packages/releaser` - Release management utilities
- `packages/ui` - Shared UI components

### 技术栈

- **Node.js**：>= 24.14.1（通过 Volta 强制执行）
- **Package Manager**：npm 11.11.0
- **Framework**：Next.js 14.x、Hono、Nest.js
- **Database**：PostgreSQL，使用 Drizzle ORM 和 legacy sequelize
- **Monorepo**：npm workspaces
- **Testing**：Vitest（主要）、Jest（indexer 和 provider-console 中的 legacy）、Playwright（e2e）、React Testing Library
- **Styling**：Material-UI、Emotion、Tailwind CSS
- **State**：React Query、Jotai
- **Blockchain**：Cosmos、Akash network

### 构建项目

#### 使用 Docker Compose（推荐用于开发）

构建生产 images：
```bash
npm run dc:build
```

以开发模式运行服务：
```bash
npm run dc:up:dev
```

运行指定服务及其依赖：
```bash
npm run dc:up:dev -- deploy-web
```

停止所有服务：
```bash
npm run dc:down
```

#### 构建单个应用

每个应用都有自己的 build script。进入应用目录并运行：
```bash
cd apps/<app-name>
npm run build
```

### 运行测试

重要：push 前，请始终在受影响的 app 中运行：
1. `npm test`（运行 unit、integration 和 functional tests）
2. `npm run lint -- --quiet`
3. `npx tsc --noEmit`

#### Unit Tests

所有应用和 packages 都使用 **Vitest** 进行 unit testing。

**在 applications 中：**
```bash
# Run all unit tests
cd apps/<app-name>
npm run test:unit

# Run with watch mode
npm run test:unit -- --watch
```

**在 packages 中：**
```bash
# Run tests for all packages
npm run test -w ./packages

# Run tests for a specific package
cd packages/<package-name>
npm test
```

#### Integration Tests

Integration tests 会针对真实 infrastructure（database 等）运行，目前用于 `apps/api`。

- **Naming**：`*.integration.ts`（与 unit tests 一样，和源文件放在同一位置）
- **Running**：
  ```bash
  cd apps/api
  npm run test:integration
  ```
- **Setup**：需要通过 `npm run test:ci-setup` 运行 Docker services
- **Vitest project**：在 `vitest.config.ts` 中配置为单独的 `integration` project，拥有自己的 setup files 和更长的 timeouts（60s test，30s hook）

#### Functional Tests

Functional tests 可用于 `apps/api`、`apps/notifications`、`apps/provider-proxy`：

```bash
cd apps/<app-name>
npm run test:functional

# With watch mode
npm run test:functional -- --watch
```

**Functional Tests 的 CI Setup/Teardown：**

某些服务需要先运行 Docker services，functional tests 才能执行。这些服务提供 `test:ci-setup` 和 `test:ci-teardown` scripts：

- **`apps/api`**：
  ```bash
  cd apps/api
  npm run test:ci-setup    # Start required Docker services
  npm run test:functional # Run functional tests
  npm run test:ci-teardown # Stop Docker services
  ```

- **`apps/notifications`**：
  ```bash
  cd apps/notifications
  npm run test:ci-setup     # Start database service
  npm run test:functional  # Run functional tests
  npm run test:ci-teardown # Stop Docker services
  ```

这些 scripts 使用 Docker Compose（`dc`）管理测试依赖。setup script 以 detached mode（`-d`）启动服务，teardown 会停止所有服务。

#### End-to-End（E2E）Tests

E2E tests 可用于 `apps/api`、`apps/deploy-web`、`apps/provider-proxy`：

```bash
cd apps/deploy-web
npm run test:e2e
```

deploy-web 中的 E2E tests 需要：
- 已安装 Playwright browsers：`npx playwright install`
- 在 `env/.env.test` 文件中配置 test environment variables（参见 app-specific documentation）

#### 运行所有测试

要同时运行 unit 和 functional tests：
```bash
cd apps/<app-name>
npm test
```

### TypeScript 配置

所有项目都使用 **strict TypeScript**，包含以下关键设置：
- `"strict": true` - 启用所有严格类型检查选项
- `"noImplicitAny": true` - 防止隐式 `any` 类型
- 通过 packages 中的 `validate:types` scripts 强制执行 type checking

**Type checking packages：**
```bash
# Check all packages
npm run validate:types -w ./packages

# Check specific package
cd packages/<package-name>
npm run validate:types
```

**Type checking applications：**
```bash
cd apps/<app-name>
# or
npx tsc --noEmit
```

### Linting

项目使用 **ESLint**，其共享配置来自 `packages/dev-config`。所有代码都会通过 `lint-staged` 和 `husky` 在 commit 时自动 lint。

#### 运行 Linting

**从根目录运行：**
```bash
# Lint entire monorepo
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

**在单个 applications/packages 中：**
```bash
cd apps/<app-name>
npm run lint

# Most apps also support auto-fix
npm run lint -- --fix
```

#### Linting 配置

- **Base config**：`packages/dev-config/.eslintrc.base.js` - 所有项目的通用规则
- **TypeScript config**：`packages/dev-config/.eslintrc.ts.js` - TypeScript-specific rules
- **Next.js config**：`packages/dev-config/.eslintrc.next.js` - web apps 的 Next.js-specific rules
- **Root config**：`.eslintrc.js` - Monorepo-wide overrides

##### 关键 Linting 规则

- **Import sorting**：通过 `eslint-plugin-simple-import-sort` 强制执行
- **Import validation**：`eslint-plugin-import-x` 检查：
  - Extraneous dependencies
  - Circular dependencies
  - Self-imports
  - Useless path segments
- **TypeScript**：强制使用一致的 type imports，并对 `any` types 发出警告
- **Custom rules**：`eslint-plugin-akash` 包含 project-specific rules（例如 `akash/no-mnemonic`）

### Commits

项目使用 **semantic release** 和 **conventional commits** 来自动完成版本管理和 changelog 生成。所有 commit messages **必须遵守 `commitlintrc.json` 中定义的规则**。

## Dependency Injection

大多数 backend apps 使用 **tsyringe** 进行 DI。例外是 `apps/notifications`（NestJS 内置 DI）和 `apps/indexer`（无 DI，直接 imports）。

- 对 stateless services 使用 `@singleton()`，对 request-scoped services 使用 `@scoped(Lifecycle.ResolutionScoped)`
- 在 `src/providers/` files 中注册 providers，这些文件会在 bootstrap 期间通过 side effects 导入
- 在 route handlers 中通过 `container.resolve(ServiceClass)` 从 container 解析 services

## Routing Pattern（apps/api）

Routes 使用 **Hono** 和 `@hono/zod-openapi` 来提供 type-safe、OpenAPI-documented endpoints：

```typescript
import { createRoute } from "@src/core/lib/create-route/create-route";
import { OpenApiHonoHandler } from "@src/core/services/open-api-hono-handler/open-api-hono-handler";

const myRouter = new OpenApiHonoHandler();

const myRoute = createRoute({
  method: "get",
  path: "/v1/example",
  tags: ["Example"],
  security: SECURITY_BEARER_OR_API_KEY,
  responses: { 200: { description: "Success", content: { "application/json": { schema: MyResponseSchema } } } }
});

myRouter.openapi(myRoute, async function routeGetExample(c) {
  return c.json(await container.resolve(MyController).getExample(), 200);
});
```

- 始终使用来自 `@src/core/lib/create-route/create-route` 的 `createRoute`（它用 cache-control 和 body-limit middleware 包装 `@hono/zod-openapi`）
- 始终使用 `OpenApiHonoHandler`（它用 centralized error handling 包装 `OpenAPIHono`）
- Route handlers 从 tsyringe container 解析 controllers
- Error responses 使用 `http-errors` package，而不是 custom error classes

## Data Access（apps/api）

- Repositories 继承自 `@src/core/repositories/base.repository` 中的 `BaseRepository<T, Input, Output>`
- 内置 CRUD、pagination、基于 CASL ability 的 row filtering，以及 Drizzle ORM transaction support
- 在 data layer 使用 `DrizzleAbility` 进行 authorization

## Path Aliases

所有 backend apps 都使用这些 TypeScript path aliases（定义于 `tsconfig.build.json`）：
- `@src/*` → `./src/*`
- `@test/*` → `./test/*`

## Test File Conventions

- **Naming**：`*.spec.ts`（不是 `*.test.ts`）
- **Location**：与源文件 colocated（不放在 `__tests__/` directories 中）
- **Mocking**：使用 `vitest-mock-extended`（`mock()`、`MockProxy<T>`）
- **Environment**：`@akashnetwork/env-loader` 从 `env/.env.*.test` files 加载 vars

## 在 unit 和 service level tests 中使用 `setup` function，而不是 `beforeEach`

查看详细指南：
@./.claude/instructions/setup-function-instead-of-beforeeach-in-unit-service-level-tests.md

## 使用 `LoggerService`，而不是 `console.log/warn/error`

查看详细指南：
@./.claude/instructions/use-logger-service-instead-of-console.md

## Commit and PR Conventions

查看详细指南：
@./.claude/instructions/commit-and-pr-conventions.md

## 在 tests 中使用 `mock<T>()`，而不是 `as unknown as <Type>`

查看详细指南：
@./.claude/instructions/use-mock-instead-of-as-unknown-as-in-tests.md

## 编写 Tests

在本 repo 中编写、修复、review 或 refactor tests 时，始终使用 `/console-tests` skill。
