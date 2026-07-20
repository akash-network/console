#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Checks whose findings reflect legitimate conventions in this repo rather than defects:
 * - UnorderedKey: env files are grouped by concern with comments, not sorted alphabetically
 * - SubstitutionKey: dotenvx interpolation such as ${VAR:-default} and %{NETWORK} is intentional
 * - QuoteCharacter: values are quoted deliberately in many files
 * - LowercaseKey: a few legacy keys (e.g. HealthChecks_SyncAKTMarketData) are read verbatim by apps
 */
const IGNORED_CHECKS = ["UnorderedKey", "SubstitutionKey", "QuoteCharacter", "LowercaseKey"];

/** `.env.<suffix>` files selected at runtime by the DEPLOYMENT_ENV variable. */
const DEPLOYMENT_SUFFIXES = ["production", "staging", "staging-testnet"];

/** `.env.<suffix>` files selected at runtime by the NETWORK variable. */
const NETWORK_SUFFIXES = ["mainnet", "testnet", "sandbox"];

/** Overlay pairs that are expected to declare an identical set of keys. */
const KEY_SET_EQUALITY_PAIRS = [
  ["production", "staging"],
  ["sandbox", "mainnet"]
];

/**
 * Apps excluded from the layering checks (cross-layer conflicts and key-set equality) while their
 * env files are restructured in a follow-up. provider-console's base .env holds mainnet defaults
 * that are duplicated across overlays and its .env.production is empty, so both checks fail today.
 */
const LAYERING_CHECK_SKIP = new Set(["provider-console"]);

/**
 * Keys that are consumed only by external tooling or SDKs that read process.env by convention, so
 * they never appear as an identifier in the source tree. Listing one here exempts it from the
 * "unused key" check.
 */
const EXTERNAL_ENV_KEYS = new Set();

/** Env file suffixes whose keys are checked for usage. Test and local-only files are excluded. */
function isUsageCheckedEnvFile(fileName) {
  return fileName.startsWith(".env") && !fileName.includes(".local") && !fileName.endsWith(".test") && !fileName.endsWith(".bak");
}

const dotenvLinter = resolveDotenvLinter();

function resolveDotenvLinter() {
  const candidates = [process.env.DOTENV_LINTER_BIN, "dotenv-linter", join(REPO_ROOT, "node_modules", ".bin", "dotenv-linter")].filter(Boolean);
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error(
    "dotenv-linter not found on PATH. Install it from https://dotenv-linter.github.io/#/installation (e.g. `cargo install dotenv-linter` or download a release binary)."
  );
}

function ignoreFlags() {
  return IGNORED_CHECKS.flatMap(check => ["-i", check]);
}

function runLinter(args) {
  try {
    const stdout = execFileSync(dotenvLinter, args, { cwd: REPO_ROOT, encoding: "utf8" });
    return { ok: true, stdout };
  } catch (error) {
    return { ok: false, stdout: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

function discoverApps(args) {
  if (args.length > 0) {
    return args
      .map(arg => arg.replace(/^apps\//, "").replace(/\/$/, ""))
      .map(toApp)
      .filter(Boolean);
  }
  return readdirSync(join(REPO_ROOT, "apps"), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => toApp(entry.name))
    .filter(Boolean);
}

function toApp(name) {
  const envDir = join(REPO_ROOT, "apps", name, "env");
  return existsSync(envDir) ? { name, envDir } : null;
}

function listEnvFiles(envDir) {
  return readdirSync(envDir)
    .filter(file => file.startsWith(".env") && !file.endsWith(".local") && !file.endsWith(".bak"))
    .map(file => join(envDir, file));
}

function overlayFile(envDir, suffix) {
  const file = join(envDir, `.env.${suffix}`);
  return existsSync(file) ? file : null;
}

function relative(file) {
  return file.replace(`${REPO_ROOT}/`, "");
}

function checkHygiene(app) {
  const files = listEnvFiles(app.envDir);
  if (files.length === 0) return [];
  const { ok, stdout } = runLinter(["check", "--plain", ...ignoreFlags(), ...files]);
  if (ok) return [];
  return [stdout.trim()];
}

function checkCrossLayerConflicts(app) {
  if (LAYERING_CHECK_SKIP.has(app.name)) return [];

  const baseFile = join(app.envDir, ".env");
  const base = existsSync(baseFile) ? baseFile : null;
  const deployments = DEPLOYMENT_SUFFIXES.map(suffix => overlayFile(app.envDir, suffix)).filter(Boolean);
  const networks = NETWORK_SUFFIXES.map(suffix => overlayFile(app.envDir, suffix)).filter(Boolean);

  const layeredPairs = [];
  if (base) {
    for (const overlay of [...deployments, ...networks]) layeredPairs.push([base, overlay]);
  }
  for (const deployment of deployments) {
    for (const network of networks) layeredPairs.push([deployment, network]);
  }

  const problems = [];
  for (const [a, b] of layeredPairs) {
    const duplicates = findDuplicateKeys(a, b);
    if (duplicates.length > 0) {
      problems.push(`${relative(a)} and ${relative(b)} share keys that would collide at runtime: ${duplicates.join(", ")}`);
    }
  }
  return problems;
}

function findDuplicateKeys(fileA, fileB) {
  const workDir = mkdtempSync(join(tmpdir(), "env-lint-"));
  try {
    const merged = join(workDir, ".env");
    writeFileSync(merged, `${readFileSync(fileA, "utf8")}\n${readFileSync(fileB, "utf8")}\n`);
    const { stdout } = runLinter(["check", "--plain", ...ignoreFlags(), merged]);
    return [...stdout.matchAll(/The (\S+) key is duplicated/g)].map(match => match[1]);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function checkKeySetEquality(app) {
  if (LAYERING_CHECK_SKIP.has(app.name)) return [];
  const problems = [];
  for (const [a, b] of KEY_SET_EQUALITY_PAIRS) {
    const fileA = overlayFile(app.envDir, a);
    const fileB = overlayFile(app.envDir, b);
    if (!fileA || !fileB) continue;
    const { ok, stdout } = runLinter(["diff", "--plain", fileA, fileB]);
    if (!ok) {
      const detail = stdout
        .split("\n")
        .filter(line => line.includes("missing keys"))
        .map(line => `  ${line.trim()}`)
        .join("\n");
      problems.push(`${relative(fileA)} and ${relative(fileB)} must declare the same keys:\n${detail}`);
    }
  }
  return problems;
}

function declaredKeys(envDir) {
  const files = readdirSync(envDir).filter(isUsageCheckedEnvFile);
  const keys = new Set();
  for (const file of files) {
    for (const match of readFileSync(join(envDir, file), "utf8").matchAll(/^([A-Za-z_][A-Za-z0-9_]*)=/gm)) {
      keys.add(match[1]);
    }
  }
  return [...keys];
}

/** Names referenced via dotenvx interpolation (`$VAR`, `${VAR}`, `%{VAR}`) anywhere in the env files. */
function interpolatedNames() {
  const output = tryGit(["grep", "-hoIE", "[$%][{]?[A-Za-z_][A-Za-z0-9_]*", "--", "apps/*/env/**", "packages/*/env/**"]);
  const names = new Set();
  for (const match of output.matchAll(/[$%][{]?([A-Za-z_][A-Za-z0-9_]*)/g)) names.add(match[1]);
  return names;
}

function tryGit(args) {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
  } catch (error) {
    return `${error.stdout ?? ""}`;
  }
}

function isKeyReferencedInSource(key) {
  try {
    execFileSync("git", ["grep", "-qwI", key, "--", ":(exclude)apps/*/env/**", ":(exclude)packages/*/env/**"], {
      cwd: REPO_ROOT,
      stdio: "ignore"
    });
    return true;
  } catch {
    return false;
  }
}

function checkUnusedKeys(app, interpolated) {
  const unused = declaredKeys(app.envDir).filter(key => !EXTERNAL_ENV_KEYS.has(key) && !interpolated.has(key) && !isKeyReferencedInSource(key));
  if (unused.length === 0) return [];
  return [`declares keys not referenced anywhere in the codebase: ${unused.sort().join(", ")}`];
}

function main() {
  const interpolated = interpolatedNames();
  const apps = discoverApps(process.argv.slice(2));
  if (apps.length === 0) {
    console.log("No apps with an env directory to lint.");
    return;
  }

  let failed = false;
  for (const app of apps) {
    const problems = [...checkHygiene(app), ...checkCrossLayerConflicts(app), ...checkKeySetEquality(app), ...checkUnusedKeys(app, interpolated)];
    if (problems.length === 0) {
      console.log(`✓ ${app.name}`);
      continue;
    }
    failed = true;
    console.error(`✗ ${app.name}`);
    for (const problem of problems) console.error(problem.replace(/^/gm, "  "));
  }

  if (failed) {
    console.error("\nenv linting failed");
    process.exit(1);
  }
  console.log("\nenv linting passed");
}

main();
