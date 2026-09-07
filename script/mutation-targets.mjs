import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import picomatch from "picomatch";
import { resolveConfig } from "vitest/node";

const MAX_RANGES = Number(process.env.MAX_MUTATION_RANGES ?? 200);

/** A mutant in a declaration or a generated file pins nothing, and no app's coverage config bothers to exclude them. */
const NEVER_MUTATED = ["**/*.d.ts", "**/*.gen.ts"];

const [workspacePath, baseRef, ...flags] = process.argv.slice(2);
const outFile = flags[flags.indexOf("--out") + 1];

if (!workspacePath || !baseRef) {
  process.stderr.write("usage: node script/mutation-targets.mjs <workspace-path> <base-ref> [--out <file>]\n");
  process.exit(2);
}

report(await mutationTargets(workspacePath, baseRef));

async function mutationTargets(workspace, base) {
  const testScript = unitTestScriptOf(workspace);

  if (!testScript.includes("vitest")) {
    return { skip: `${workspace} does not run its unit tests on vitest` };
  }

  const isMutatable = await coverageScopeOf(workspace);
  const ranges = changedLineRanges(workspace, base).filter(({ file }) => isMutatable(file));

  if (ranges.length === 0) {
    return { skip: `no mutatable source line changed in ${workspace}` };
  }

  if (ranges.length > MAX_RANGES) {
    return { skip: `${ranges.length} changed line ranges exceed the limit of ${MAX_RANGES}` };
  }

  return {
    mutate: ranges.map(({ file, start, end }) => `${file}:${start}-${end}`).join(","),
    ranges: ranges.length,
    testEnv: envPrefixOf(testScript)
  };
}

/**
 * Whatever a workspace measures coverage on is what its tests are expected to cover, so mutating exactly that set
 * keeps the two from drifting: a file the workspace excludes from coverage cannot drag the mutation score down.
 */
async function coverageScopeOf(workspace) {
  const { vitestConfig } = await resolveConfig({ root: workspace });
  const { include = [], exclude = [] } = vitestConfig.coverage;
  const isMeasured = picomatch(include);
  const isExcluded = picomatch([...exclude, ...NEVER_MUTATED]);

  return file => isMeasured(file) && !isExcluded(file);
}

function changedLineRanges(workspace, base) {
  const diff = execFileSync("git", ["diff", "--unified=0", base, "HEAD", "--", `${workspace}/src`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const ranges = [];
  let file = null;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const target = line.slice(4);
      file = target === "/dev/null" ? null : target.replace(/^b\//, "").replace(`${workspace}/`, "");
      continue;
    }

    if (!file || !line.startsWith("@@ ")) continue;

    const [start, count = "1"] = line.split(" ")[2].slice(1).split(",");
    if (Number(count) > 0) ranges.push({ file, start: Number(start), end: Number(start) + Number(count) - 1 });
  }

  return ranges;
}

function unitTestScriptOf(workspace) {
  const { scripts = {} } = JSON.parse(readFileSync(join(workspace, "package.json"), "utf8"));

  return scripts["test:unit"] ?? scripts.test ?? "";
}

function envPrefixOf(testScript) {
  const assignments = [];

  for (const token of testScript.split(/\s+/)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*=\S*$/.test(token)) break;
    assignments.push(token);
  }

  return assignments.join(" ");
}

function report({ mutate = "", ranges = 0, testEnv = "", skip = null }) {
  const json = JSON.stringify({ mutate, ranges, testEnv, skip });

  if (outFile) writeFileSync(outFile, `${json}\n`);
  else process.stdout.write(`${json}\n`);
}
