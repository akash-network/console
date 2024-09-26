## Contribution Guidelines for Akash Network Console Repository
### Overview

Thank you for considering contributing to the Akash Network Console repository. These guidelines ensure that all contributions are valuable, feasible, and maintain our project's quality standards.

### I. Before Contributing

1. **Open an Issue**: Before making changes, open an issue to discuss your proposed feature or bug fix.
2. **Describe Clearly**: Provide a clear description of the change, including any required information specified in the issue labels.

### II. Pull Requests

1. **Single Purpose**: Each PR should address one specific feature or bug.
2. **Keep it Small**: Limit changes per PR. Multiple small PRs are preferred over large ones.
3. **Link to Issue**: Reference the related issue in your PR description.

### III. Monorepo

Akash Console repo is a monorepo which contains multiple applications under the `/apps` folder. There's also a `/packages` folder that contains re-used projects between applications. Please take the time to review all the available packages to make sure you don't duplicate code that is already available.

Installing an npm package to console must be done at the root with the following example:

```
npm i -w ./apps/deploy-web name-of-the-package@version
```

### IV. Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) standard:

```
fix: resolved bug in node dockerfile

# Notes:
If your commit targets a specific feature/domain, add it to your commit like so:

feat(wallet): add a new function to compute wallet balance
```
### V. Code Quality and Readability

- **Apply Best Practices for Code Readability**: Ensure your code follows established best practices for coding standards, documentation, and formatting.
- **Include Unit Tests (When Applicable)**: Verifiable unit tests aid in maintaining code quality and prevent additional bugs from being introduced.
- **Linting**: Run `npm run lint:fix` to make sure your code is properly formatted.

### Big Features

For large features or significant changes:

1. Create a fork of the main repository.
2. Implement your feature in small, incremental pull requests to your fork.
3. This allows us to gradually review the changes and provide guidance throughout the development process.
4. Once the feature is complete and has gone through the review process on the fork, we can then merge it into the main repository.

This approach helps manage complex features more effectively and ensures that large changes are thoroughly reviewed before being integrated into the main codebase.

### Contribution Process Overview

If you're ready to contribute, follow our guidelines:

- Open an issue describing the bug or feature you'd like to address
- Once issues are created and reviewed, make changes while following the mentioned guidelines
- Once you're satisfied with your contributions, submit a pull request according to our guidelines
- A Core Developer Team member will assist and review your included changes accordingly.

Note that this process allows multiple developers to collaborate effectively and maintain high-quality code for a long-lasting entity; the project.  

*That your commitment to following these specs will make a difference.*