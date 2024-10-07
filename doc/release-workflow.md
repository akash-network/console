# Release Workflow Documentation

## Overview

This release workflow leverages **release-it**, **Docker**, **Docker Compose**, **GitHub Actions**, and a set of custom CLI bash scripts to manage the release process. The workflow adheres to **Semantic Versioning (SemVer)** and supports both beta pre-releases and final releases.

## Release Flow

The release process is divided into two key stages: pre-release (beta) and final release. This is done using SemVer conventions.

### 1. Pre-Release (Beta)

To create a **pre-release** (beta) version, the following command is used. This will create a beta version using the `release-it` tool with the specified options:

```bash
npm run release -w apps/$APP -- --preRelease=beta --verbose --ci -r $REGISTRY
```

#### Key Options:
- `--preRelease`: Marks the release as a beta pre-release.
- `--verbose`: Provides detailed output for troubleshooting.
- `--ci`: Ensures the release runs in a continuous integration environment.
- `-r`: Registry to push the Docker image.

### 2. Final Release

For creating a final release, the command below is used. This will bump the version based on SemVer and push the release.

```bash
npm run release -w apps/$APP -- --verbose --ci -r $REGISTRY
```

This should be run manually after validating the beta pre-release. Manual workflow is available in the GitHub Actions interface.

## GitHub Actions Workflow

### Pre-Release on Merge

When a merge occurs on the `main` branch, a **beta** version is automatically created using GitHub Actions. The workflow is triggered by the merge event, ensuring that each change is reflected in a pre-release.

### Manual Release

Final releases are not triggered automatically. Instead, they are initiated manually via the GitHub Actions interface. This allows for flexibility in verifying and ensuring that the beta version is stable before creating an official release.

## Customs scripts
Scripts that are used in the release process are located in the `docker` package. These scripts are used to build Docker images, deploy services, and manage the release process. Check out the [README.md](../packages/docker/README.md) for more details.
`release-it` config is also shared via local packages.

## Roadmap
- add alpha pre-release once development is provisioned
- implement actual deployment to infra as currently only the Docker image is build and pushed