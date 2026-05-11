## Database Structure

[English](database-structure.md) | [Simplified Chinese](database-structure.zh-CN.md)

我们的项目使用双 ORM 方式进行数据库管理：

1. **Sequelize-TypeScript**：
   - 用于定义主要 database schema。
   - Schema definitions 位于 [/shared/dbSchemas/](../packages/database/dbSchemas/)。
   - Models 组织在以下文件夹中：
     - **base**：Cosmos 通用并用于每条链的 tables
     - **akash**：Akash-specific tables
     - **user**：User-specific tables，包含 user settings 和 templates 相关 tables

2. **Drizzle ORM**：
   - 在 API 中用于 database operations。
   - 配置可在 API directory 中的 `drizzle.config.ts` 找到。

同时使用这两个 ORM 使我们能够发挥各自优势：
- Sequelize-TypeScript 提供稳健的 schema definition 和 migration capabilities。
- Drizzle ORM 为 API operations 提供 type-safe queries 和更好的性能。

有关 Drizzle ORM setup 和用法的更多详情，请参阅 API directory 中的 `drizzle.config.ts` 文件。

注意：我们计划最终将所有 models 迁移到 drizzle，因此当您想添加新 tables 时，请使用 drizzle 添加。
