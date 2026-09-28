/**
 * Prints the dorny/paths-filter filters CI evaluates once per run: `<app>` for what the app's validation
 * depends on, and `<app>-image-build` for what only its image build reads.
 *   node script/app-change-filters.mjs
 */
import { readdirSync } from "node:fs";

import { findLocalPackageDependencies } from "../packages/releaser/find-local-package-dependencies.js";

const APP_VALIDATION_FILES = [
  "package-lock.json",
  ".github/workflows/all-ci.yml",
  ".github/workflows/reusable-validate-app.yml",
  ".github/workflows/reusable-validate-app-unsafe.yml",
  "script/app-change-filters.mjs"
];

const IMAGE_BUILD_FILES = ["packages/docker/**", ".dockerignore", "script/safe-deps-install.sh", "package.json", "package-lock.json"];

const apps = readdirSync("apps", { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name);

const filters = Object.fromEntries(
  apps.flatMap(app => [
    [app, [`apps/${app}/**`, ...findLocalPackageDependencies(`./apps/${app}`).map(path => `${path}/**`), ...APP_VALIDATION_FILES]],
    [`${app}-image-build`, [...IMAGE_BUILD_FILES, `apps/${app}/next.config.*`]]
  ])
);

process.stdout.write(JSON.stringify(filters));
