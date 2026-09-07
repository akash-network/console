/**
 * Run from a workspace directory, mutating only the lines the diff touched:
 *   cd apps/api && npx stryker run ../../stryker.config.mjs --mutate 'src/x.ts:10-24'
 * CI does that for every changed file of the app it validates.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

const number = (name, fallback) => Number(process.env[name] ?? fallback);
const breakThreshold = process.env.STRYKER_BREAK ? number("STRYKER_BREAK", 0) : null;

/** Relative on purpose: an absolute path would point vitest at the real workspace instead of Stryker's mutated copy. */
const unitOnlyConfigFile = ["vitest.mutation.config.ts", "vitest.mutation.config.mts"].find(name => existsSync(join(process.cwd(), name)));

export default {
  testRunner: "vitest",
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
  timeoutFactor: 2.5,
  maxTestRunnerReuse: 20,
  ignorePatterns: [".stryker-tmp", "coverage", "dist", ".next", "reports"],
  ignoreStatic: true,
  thresholds: { high: 100, low: 100, break: breakThreshold },
  logLevel: "info"
};
