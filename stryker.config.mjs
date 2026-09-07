/**
 * Run from a workspace directory, mutating only the lines the diff touched:
 *   cd apps/api && npx stryker run ../../stryker.config.mjs --mutate 'src/x.ts:10-24'
 * CI does that for every changed file of the app it validates.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const number = (name, fallback) => Number(process.env[name] ?? fallback);
const breakThreshold = process.env.STRYKER_BREAK ? number("STRYKER_BREAK", 0) : null;

/** Relative on purpose: an absolute path would point vitest at the real workspace instead of Stryker's mutated copy. */
const unitOnlyConfigFile = ["vitest.mutation.config.ts", "vitest.mutation.config.mts"].find(name => existsSync(join(process.cwd(), name)));

/** Absolute because Stryker resolves a relative plugin path against the workspace it runs from, not against this file. */
const observabilityIgnorer = fileURLToPath(new URL("script/stryker-observability-ignorer.mjs", import.meta.url));

export default {
  testRunner: "vitest",
  plugins: ["@stryker-mutator/*", observabilityIgnorer],
  /** A mutant inside a log call can only survive: the arguments are not part of the behaviour a unit test asserts on. */
  ignorers: ["observability"],
  vitest: {
    /** Off by default: vitest's related-file detection fails on some suites, and Stryker treats that as zero tests. */
    related: process.env.STRYKER_VITEST_RELATED === "true",
    ...(unitOnlyConfigFile ? { configFile: unitOnlyConfigFile } : {})
  },
  coverageAnalysis: "perTest",
  reporters: ["clear-text", "json"],
  jsonReporter: { fileName: process.env.STRYKER_JSON_REPORT ?? "reports/mutation/mutation.json" },
  clearTextReporter: { logTests: false, reportTests: false, reportMutants: true, reportScoreTable: true },
  tempDirName: ".stryker-tmp",
  concurrency: number("STRYKER_CONCURRENCY", 2),
  timeoutMS: number("STRYKER_TIMEOUT_MS", 60_000),
  /** The dry run executes the whole unit suite once, which outlasts Stryker's 5-minute default on a CI runner. */
  dryRunTimeoutMinutes: number("STRYKER_DRY_RUN_TIMEOUT_MINUTES", 20),
  timeoutFactor: 2.5,
  maxTestRunnerReuse: 20,
  ignorePatterns: [".stryker-tmp", "coverage", "dist", ".next", "reports"],
  ignoreStatic: true,
  thresholds: { high: 100, low: 100, break: breakThreshold },
  logLevel: "info"
};
