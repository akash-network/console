// @ts-check
import { existsSync } from "node:fs";
import path from "node:path";

const gitRoot = process.cwd();

/**
 * Nearest ancestor (including the file's own directory) that owns an
 * eslint.config.mjs, defaulting to the repo root. lint-staged runs from the git
 * root, but flat config resolves a single config from cwd — so each staged file is
 * linted against its owning config to keep app-local rules and parser options
 * (e.g. decorator metadata for DI) authoritative, exactly as `npm run lint` does
 * inside that workspace.
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

function eslintCommandsByOwningConfig(files) {
  const filesByConfig = new Map();
  for (const file of files) {
    const config = findOwningEslintConfig(file);
    filesByConfig.set(config, [...(filesByConfig.get(config) ?? []), file]);
  }
  return [...filesByConfig].map(([config, group]) => `eslint --fix --quiet --config ${toArg(config)} ${group.map(toArg).join(" ")}`);
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
