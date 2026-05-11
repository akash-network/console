# Environment Variables & Configuration

[English](apps-configuration.md) | [Simplified Chinese](apps-configuration.zh-CN.md)

## 概述

**Next.js frontend** 和 **Node.js backend** 应用都使用环境变量来管理配置。本指南提供了一套统一的方法来管理这些变量，并使用基于 **Zod** 的验证来确保两个应用中的配置都正确。

### Environment Files

我们使用 `.env*` 文件管理环境变量，并在两个应用中保持一致的加载顺序。这些文件有助于将特定环境的配置与敏感信息分离。

### Next.js Environment Variables Behavior

除下文描述的逻辑外，**Next.js app** 中的环境变量遵循标准 Next.js 行为，如 [Next.js environment variables documentation](https://nextjs.org/docs/basic-features/environment-variables) 中所述。这意味着 `.env.local` 或 `.env.production` 等文件会根据 app 运行的环境自动加载，从而确保 development、staging 和 production environments 之间平滑切换。

### Loading Order

对于 **Next.js** 和 **Node.js** 应用，环境变量按以下顺序加载：

1. **System Environment Variables**：在系统环境中设置的变量（例如通过 CI/CD pipelines）具有最高优先级，并且永远不会被 `.env` 文件中的值覆盖。
2. **`env/.env.local`**：包含本地开发专用的敏感值。该文件不由 Git 跟踪，应包含本地使用的 secrets。
3. **`env/.env`**：包含适用于所有环境的默认值。该文件包含在版本控制中，不应包含敏感数据。
4. **`env/.env.${DEPLOYMENT_ENV}`**：包含特定 deployment environment（例如 production、staging）的值。该文件会根据 `DEPLOYMENT_ENV` 变量加载。
5. **`env/.env.${NETWORK}`**：包含特定 network environment（例如 mainnet、testnet）的值。该文件会根据 `NETWORK` 变量加载。

### Variable Precedence

- 从高优先级来源加载的变量（例如 system environment variables 或 `.env.local`）会覆盖低优先级文件中定义的变量（例如 `.env` 或 `.env.production`）。

### Configuration Structure

所有应用配置都应组织并存储在 app directories 中的特定文件内：

- **Configuration Files**：
  - Configurations 必须放在 `apps/*/config/<module>.config.ts` 文件中，用于每个 module-specific configuration。
  - 环境变量应保留其原始 **SCREAMING_CASE** 名称，并直接使用 **Zod** schemas 解析/验证，不要重命名。

- **Split by Domain**：
  - Configurations 应按 **application domain** 拆分。这有助于保持清晰度和关注点分离，并根据相关 features 或 domains 对配置进行逻辑分组（例如 database、authentication、API endpoints）。

### Environment Variables

- **Separation of Environment Variables**：
  - 环境变量必须与 hardcoded configuration values 分离，以便将敏感或特定环境的数据保留在 codebase 之外。
  - 按 **Loading Order** 章节所述使用 `.env*` 文件，并确保所有环境变量在应用内使用前都通过 schemas 进行 **validated**。

### Zod-Based Validation

**Next.js** 和 **Node.js** apps 都使用 **Zod** schemas 验证环境变量，确保所有必需变量都存在且具有有效值。验证分两个阶段应用：

- **Build-Time Validation**（仅限 Next.js）：在 **Next.js** app 中，变量会在 build time 使用 `src/config/env-config.schema.ts` 文件中定义的 **Zod** schemas 进行验证。如果任何必需变量缺失或无效，build 将失败。
  
- **Runtime Validation**（所有 Apps）：**Next.js** 和 **Node.js** 应用都会在 server 启动时执行 **runtime validation**。这可确保所有关键环境变量在 server 启动前都存在且有效。如果任何必需变量缺失或不正确，server 将无法启动。

### Example of Environment Variable Validation with Zod

```typescript
// apps/config/env.config.ts
import { z } from "zod";

// Define the schema for environment variables
const envSchema = z.object({
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
  DATABASE_HOST: z.string(),
  DATABASE_USER: z.string(),
  SECRET_KEY: z.string(),
});

// Parse and validate the environment variables
export const envConfig = envSchema.parse(process.env);

// Access the variables
console.log(envConfig.LOG_LEVEL);
console.log(envConfig.DATABASE_HOST);
```

### Sample Environment Variables

下面是一个与上述 validation schema 对应的 `.env` 文件示例：

```bash
# .env (shared across environments)
LOG_LEVEL=info
DATABASE_HOST=https://db.example.com
DATABASE_USER=myUser
SECRET_KEY=MY_SECRET_KEY

# .env.local (development-specific, not included in version control)
DATABASE_HOST=http://localhost:5432
DATABASE_USER=localUser
SECRET_KEY=LOCAL_SECRET_KEY

# .env.production (production-specific)
DATABASE_HOST=https://prod-db.example.com
SECRET_KEY=PROD_SECRET_KEY
```

#### Sample Local Environment Variables

为了方便本地开发，某些应用包含 `.env.local.sample` 文件，其中包含本地设置专用的环境变量。这些文件中的敏感值会设置为 dummy placeholders，使 app 能够启动并在开发期间支持大多数功能。

不过，某些功能可能需要真实值才能正常工作。例如：

- **Authentication**：依赖 Auth0 的功能无法运行，除非您在 `deploy-web` 应用的 `.env.local` 文件中提供真实 Auth0 credentials。
- **Managed Wallet Operations**：与 wallet 相关的功能无法工作，除非您创建 wallets 并提供必要的 addresses、mnemonics 等。

#### Using the Sample Files

1. 将 `.env.local.sample` 文件复制为相应目录中的 `.env.local`。
2. 根据需要将 placeholder values 更新为实际值。

### Sample Environment Variables Template

两类应用的 `env/.env.sample` 文件中都提供了设置所需环境变量的 template。该文件包含所有必要环境变量的示例。

通过遵循这种方法，我们可以为 **Next.js** 和 **Node.js** 应用中的环境变量管理提供安全、可扩展且一致的配置流程，并通过 **Zod** 提供稳健验证，同时按 application domain 清晰拆分配置。

### Disclaimer

如果您发现 codebase 与本文档存在任何不一致，请创建 issue 或 pull request 来相应更新 codebase。本文档是跨应用管理环境变量和配置的 source of truth。
