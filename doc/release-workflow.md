# Release Workflow Documentation

## Overview

This release workflow uses **GitHub Actions**, a custom **releaser package** (`packages/releaser`), and **Docker** to automate versioning, changelog generation, image builds, and deployments. The workflow adheres to **Semantic Versioning (SemVer)** driven entirely by **Conventional Commits**.

## Release Flow

### Summary
1. Create a feature PR.
2. Make sure all the checks pass.
3. Rebase and merge the PR into `main`.
4. GitHub Actions automatically creates a GitHub release, builds Docker images, and triggers deployment.

### Automated Release on Every Push to `main`

Every push to `main` that modifies files under `apps/**/*`, `packages/**/*`, or `package-lock.json` triggers the `all-release.yml` workflow. No manual steps or pre-release PRs are required.

#### Step 1 – Detect Changed Apps

The setup job inspects the commit to find which `apps/*` changed, then groups them into two categories:

- **backends** – non-Next.js apps (e.g., `api`, `indexer`, `notifications`, `provider-proxy`, `tx-signer`)
- **nextjs** – Next.js apps (e.g., `deploy-web`, `stats-web`)

#### Step 2 – Create GitHub Release

For each changed app, `packages/releaser/recommended-bump.js` is invoked. It:

1. Reads all commits since the last git tag for the app path (including local package dependencies).
2. Determines the SemVer bump level from commit types:
   - `BREAKING CHANGE` → **major**
   - `feat` / `feature` → **minor**
   - `fix`, `refactor`, `perf` → **patch**
   - `chore`, `docs`, `style`, `test` → no release
3. Generates a changelog from visible commit types (`feat`, `fix`, `refactor`, `perf`).
4. Creates a GitHub release tagged as `<app-alias>/v<semver>` (e.g., `console-api/v1.2.3`).

App name aliases used for tags:

| Directory     | Tag prefix      |
|---------------|-----------------|
| `api`         | `console-api`   |
| `deploy-web`  | `console-web`   |
| others        | same as dir name|

If no releasable commits are found, no release or build is created.

#### Step 3 – Build Docker Images

After a successful release, `reusable-build-image.yml` builds and pushes Docker images to the app's configured container registry.

- **Backends**: one image tagged with `<semver>`.
- **Next.js apps**: two images:
  - `<semver>-beta` – built for the `staging` environment.
  - `<semver>` – built for the `production` environment.

`packages/docker/script/build.sh` handles the actual build. It skips a rebuild if an image for the same tag already exists.

#### Step 4 – Trigger Deployment

After the image build, the release workflow automatically dispatches the app's deployment workflow (e.g., `console-api-release.yml`) with `cancel-if-stale=true`, which skips the deployment if a newer version is already queued or running.

Deployment workflows follow this pattern (example: `console-api-release.yml`):
1. Deploy to **beta** (staging mainnet + sandbox).
2. Run **E2E tests** against the beta environment.
3. If tests pass, deploy to **production** (mainnet + sandbox).

## Custom Scripts

Scripts used in the build and deployment process are located in the `docker` package. See [packages/docker/README.md](../packages/docker/README.md) for details.

The `packages/releaser` package provides the versioning and changelog logic.
