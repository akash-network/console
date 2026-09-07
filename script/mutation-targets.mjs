import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import picomatch from "picomatch";
import { resolveConfig } from "vitest/node";

const MAX_RANGES = Number(process.env.MAX_MUTATION_RANGES ?? 200);
const SPEC_EXTENSIONS = [".spec.ts", ".spec.tsx", ".spec.mts"];

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
  const ranges = changedLineRanges(workspace, mergeBaseWith(base)).filter(({ file }) => isMutatable(file));

  if (ranges.length === 0) {
    return { skip: `no mutatable source line changed in ${workspace}` };
  }

  if (ranges.length > MAX_RANGES) {
    return { skip: `${ranges.length} changed line ranges exceed the limit of ${MAX_RANGES}` };
  }

  const specs = colocatedSpecsOf(workspace, ranges);

  if (specs.length === 0) {
    return { skip: `none of the changed files in ${workspace} has a colocated spec, so no mutant could be killed` };
  }

  return {
    mutate: ranges.map(({ file, start, end }) => `${file}:${start}-${end}`).join(","),
    ranges: ranges.length,
    testFiles: specs.join(","),
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

/** A shallow CI checkout has no common history to merge-base against, in which case the given ref is already the base. */
function mergeBaseWith(base) {
  try {
    return git(["merge-base", base, "HEAD"]).trim();
  } catch {
    return base;
  }
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

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
}

/**
 * A changed file's own spec is the suite that has to kill its mutants, so running just those turns the dry run from
 * the whole suite into seconds; a file without one only ever contributed mutants nothing would reach.
 */
function colocatedSpecsOf(workspace, ranges) {
  const sources = [...new Set(ranges.map(({ file }) => file))];
  const specs = sources.flatMap(source => {
    const withoutExtension = source.replace(/\.[^./]+$/, "");

    return SPEC_EXTENSIONS.map(extension => `${withoutExtension}${extension}`).filter(spec => existsSync(join(workspace, spec)));
  });

  return [...new Set(specs)];
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

function report({ mutate = "", ranges = 0, testFiles = "", testEnv = "", skip = null }) {
  const json = JSON.stringify({ mutate, ranges, testFiles, testEnv, skip });

  if (outFile) writeFileSync(outFile, `${json}\n`);
  else process.stdout.write(`${json}\n`);
}
