# Release Workflow Documentation

## Overview

This release workflow leverages **release-it**, **Docker**, **Docker Compose**, **GitHub Actions**, and a set of custom CLI bash scripts to manage the release process. The workflow adheres to **Semantic Versioning (SemVer)** and supports both beta pre-releases and final releases.

## Release Flow

### Summary
1. Create a feature PR.
2. Make sure all the checks pass.
3. Rebase and merge the PR.
4. GitHub Actions creates a pre-release PR with updated changelog and version.
5. Merge the pre-release PR.
6. GitHub Actions creates relevant GitHub releases and builds relevant Docker images.
7. Utilize manual GitHub Actions to deploy the services.

### Automated Versioning and Changelogs

The release process is conducted using SemVer conventions.
To update a changelog and bump a version the following command is used:

```bash
npm run release -w apps/$APP -- --verbose --ci
```

#### Key Options:
- `--verbose`: Provides detailed output for troubleshooting.
- `--ci`: Ensures the release runs in a continuous integration environment.


## Customs scripts
Scripts that are used in the release process are located in the `docker` package. These scripts are used to build Docker images, deploy services, and manage the release process. Check out the [README.md](../packages/docker/README.md) for more details.
`release-it` config is also shared via local packages.

## Roadmap
- implement actual deployment to infra as currently only the Docker image is build and pushed