## Akash Network Console 仓库贡献指南

[English](CONTRIBUTING.md) | [Simplified Chinese](CONTRIBUTING.zh-CN.md)

### 概述

感谢您考虑为 Akash Network Console 仓库做出贡献。这些指南旨在确保所有贡献都有价值、可行，并维护项目的质量标准。

### I. 贡献前

1. **创建 Issue**：在进行更改前，请创建一个 issue 来讨论您提议的功能或 bug fix。
2. **清晰描述**：提供对更改的清晰描述，包括 issue labels 中指定的任何必需信息。

### II. Pull Requests

1. **单一目的**：每个 PR 应只处理一个特定功能或 bug。
2. **保持小规模**：限制每个 PR 的变更范围。相比大型 PR，更推荐多个小型 PR。
3. **链接到 Issue**：在 PR 描述中引用相关 issue。

### III. Monorepo

Akash Console repo 是一个 monorepo，其中 `/apps` 文件夹下包含多个应用。另有一个 `/packages` 文件夹，包含可在应用之间复用的项目。请花时间查看所有可用 package，确保不要重复编写已经存在的代码。

为 console 安装 npm package 时，必须在仓库根目录执行，例如：

```
npm i -w ./apps/deploy-web name-of-the-package@version
```

### IV. Commit Messages

遵循 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) 标准：

```
fix: resolved bug in node dockerfile

# Notes:
If your commit targets a specific feature/domain, add it to your commit like so:

feat(wallet): add a new function to compute wallet balance
```

### V. 代码质量和可读性

- **应用代码可读性最佳实践**：确保您的代码遵循已建立的代码标准、文档和格式化最佳实践。
- **包含 Unit Tests（适用时）**：可验证的 unit tests 有助于维护代码质量，并防止引入其他 bug。
- **Linting**：运行 `npm run lint:fix`，确保您的代码已正确格式化。

### 大型功能

对于大型功能或重大更改：

1. Fork 主仓库。
2. 以小规模、增量式 pull requests 的方式在您的 fork 中实现功能。
3. 这使我们能够逐步审查更改，并在整个开发过程中提供指导。
4. 功能完成并在 fork 上经过审查流程后，我们就可以将其合并到主仓库。

这种方法有助于更有效地管理复杂功能，并确保大型更改在集成到主代码库之前得到充分审查。

### 贡献流程概览

如果您已准备好贡献，请遵循我们的指南：

- 创建 issue，描述您想处理的 bug 或功能
- issue 创建并经过审查后，按照上述指南进行更改
- 对您的贡献满意后，按照我们的指南提交 pull request
- Core Developer Team 成员会相应地协助并审查您包含的更改。

请注意，此流程允许多位开发者有效协作，并为这个长期存在的项目维护高质量代码。

### AI Coding Guidelines

本仓库使用 AI-assisted coding tools（GitHub Copilot、Cursor、Claude 等）。为了帮助这些工具生成更好的代码：

- **CLAUDE.md**：包含从已批准 RFC 中提取并汇总的贡献指南
- **Contribution RFCs**：指南来源于 [Contribution RFC category](https://github.com/akash-network/console/discussions/categories/contribution-rfc) 中的讨论
- **Auto-Generated**：当 RFC 讨论收到 `RFC:Landed` label 时，会自动生成 CLAUDE.md 文件

要贡献新的 AI 指南：

1. 在 "Contribution RFC" category 中创建一个 discussion
2. 包含一个标题为 `## AI Instructions` 的章节，为 AI coding assistants 提供指导
3. 批准后，添加 `RFC:Landed` label
4. 指南将自动添加到 CLAUDE.md

更多详情请参阅 [`.claude/README.md`](./.claude/README.md)。

*您对遵循这些规范的承诺将带来改变。*
