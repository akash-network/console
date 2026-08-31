// @ts-check
import { existsSync } from "node:fs";
import path from "node:path";

const gitRoot = process.cwd();

/**
 * Nearest ancestor (including the file's own directory) that owns an eslint.config.mjs, defaulting to the repo root.
 */
function findOwningEslintConfig(absoluteFile) {
  let dir = path.dirname(absoluteFile);
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, "eslint.config.mjs");
    if (existsSync(candidate)) return candidate;
    if (dir === gitRoot) break;
    dir = path.dirname(dir);
  }
  return path.join(gitRoot, "eslint.config.mjs");
}

const toArg = file => JSON.stringify(path.relative(gitRoot, file));

const eslintBin = path.join(gitRoot, "node_modules", ".bin", "eslint");

/**
 * Runs eslint from the owning config's directory because the shared import resolver reads `./tsconfig.json` relative to
 * cwd, so linting from the git root stops resolving `@src` aliases and silently drops every rule that follows them.
 */
function eslintCommandsByOwningConfig(files) {
  const filesByConfig = new Map();
  for (const file of files) {
    const config = findOwningEslintConfig(file);
    filesByConfig.set(config, [...(filesByConfig.get(config) ?? []), file]);
  }
  return [...filesByConfig].map(([config, group]) => {
    const configDir = path.dirname(config);
    const args = group.map(file => JSON.stringify(path.relative(configDir, file))).join(" ");
    return `sh -c 'bin="$1"; cd "$2" || exit 1; shift 2; exec "$bin" --fix --quiet "$@"' sh ${JSON.stringify(eslintBin)} ${JSON.stringify(configDir)} ${args}`;
  });
}

export default {
  "*.{mjs,js,jsx,ts,tsx}": files => [...eslintCommandsByOwningConfig(files), `prettier --write ${files.map(toArg).join(" ")}`],
  "package.json": "npx sort-package-json",
  "package-lock.json,**/*/package.json": "npm ci --dry-run --ignore-scripts > /dev/null",
  "./packages/ui/**/*.ts": "npm run validate:types -w packages/ui",
  "./packages/net/**/*.ts": "npm run validate:types -w packages/net",
  "./packages/network-store/**/*.ts": "npm run validate:types -w packages/network-store",
  "./packages/http-sdk/**/*.ts": "npm run validate:types -w packages/http-sdk",
  "./packages/logging/**/*.ts": "npm run validate:types -w packages/logging",
  "./packages/database/**/*.ts": "npm run validate:types -w packages/database"
};
