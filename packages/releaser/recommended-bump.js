import conventionalChangelogConventionalCommits from "conventional-changelog-conventionalcommits";
import { Bumper } from "conventional-recommended-bump";
import { parseArgs } from "node:util";

import { findLocalPackageDependencies } from "./find-local-package-dependencies.js";

const { values: cliOptions } = parseArgs({
  options: {
    "tag-prefix": { type: "string" },
    "repo-url": { type: "string" },
    path: { type: "string" },
    "target-sha": { type: "string" }
  }
});

const COMMIT_TYPES = [
  { type: "feat", section: "Features" },
  { type: "fix", section: "Bug Fixes" },
  { type: "refactor", section: "Code Refactoring" },
  { type: "perf", section: "Performance Improvements" },
  { type: "test", hidden: true },
  { type: "chore", hidden: true },
  { type: "docs", hidden: true },
  { type: "style", hidden: true }
];

const bumper = new Bumper(process.cwd());

bumper.loadPreset("conventionalcommits");

if (cliOptions["tag-prefix"]) {
  bumper.tag({ prefix: cliOptions["tag-prefix"] });
}

if (cliOptions.path?.length) {
  const additionalPaths = findLocalPackageDependencies(cliOptions.path);
  bumper.commits({ path: [cliOptions.path, ...additionalPaths] });
}

const lastTag = await bumper.getLastSemverTag();
const { commits: analyzedCommits } = await bumper.bump();

// Process commits oldest-first so each commit's version is derived from those before it.
// This makes version computation deterministic regardless of parallel runs:
// every run for a given commit SHA will always produce the same version.
const commits = [...analyzedCommits].reverse();

const prefix = cliOptions["tag-prefix"] || "";
const initialVersion = lastTag ? lastTag.replace(prefix, "") : "0.0.0";
let [major, minor, patch] = initialVersion.split(".").map(Number);

let targetCommit = null;
let targetCommitReleaseLevel;

// if we have more than 1 commit,
// we need to emulate version bumping for each commit to find the correct version for the target SHA
// because our release workflows are executed in parallel and out of order.
// Eventually every workflow run will determine correct and unqiue release version
for (const commit of commits) {
  const { level } = whatBump([commit]);

  if (level === 0) {
    major++;
    minor = 0;
    patch = 0;
  } else if (level === 1) {
    minor++;
    patch = 0;
  } else if (level === 2) {
    patch++;
  }

  if (!cliOptions["target-sha"] || commit.hash === cliOptions["target-sha"]) {
    targetCommit = commit;
    targetCommitReleaseLevel = level;
    break;
  }
}

// if targetCommitReleaseLevel is undefined it means that target SHA is not releaable
if (!targetCommit || targetCommitReleaseLevel === undefined) {
  console.error(JSON.stringify({ error: "No releasable commit found for this SHA" }));
  process.exit(0);
}

const nextVersion = `${major}.${minor}.${patch}`;
const nextTag = `${prefix}${nextVersion}`;
const repoUrl = cliOptions["repo-url"] || "";
const { writer: changelogWriter } = await conventionalChangelogConventionalCommits({ types: COMMIT_TYPES });

console.log(
  JSON.stringify({
    analyzedCommitsCount: analyzedCommits.length,
    currentVersion: initialVersion,
    nextVersion,
    nextTag,
    changelog: (() => {
      const [, owner, repository] = repoUrl.match(/github\.com\/([^/]+)\/(.+)$/) ?? [];

      const transformed = changelogWriter.transform(targetCommit, {
        host: "https://github.com",
        owner: owner || "",
        repository: repository || "",
        repoUrl,
        linkReferences: !!repoUrl
      });
      const date = new Date().toISOString().split("T")[0];
      const compareUrl = lastTag ? `${repoUrl}/compare/${lastTag}...${nextTag}` : `${repoUrl}/commits/${nextTag}`;
      const scope = transformed.scope ? `**${transformed.scope}:** ` : "";
      const hash = transformed.shortHash ? ` ([${transformed.shortHash}](${repoUrl}/commit/${targetCommit.hash}))` : "";

      const changelogLines = [`## [${nextVersion}](${compareUrl}) (${date})`, "", `### ${transformed.type}`, "", `* ${scope}${transformed.subject}${hash}`];

      if (transformed.notes?.length) {
        changelogLines.push("", "### ⚠ BREAKING CHANGES", "");
        changelogLines.push(...transformed.notes.map(note => `* ${note.text}`));
      }

      return changelogLines.join("\n");
    })()
  })
);

function whatBump(commits) {
  let level;
  let breakings = 0;
  let features = 0;

  commits.forEach(commit => {
    const isHiddenType = COMMIT_TYPES.find(type => type.type === commit.type)?.hidden || false;

    addBangNotes(commit);

    if (commit.notes.length > 0) {
      breakings += commit.notes.length;
      level = 0;
    } else if (commit.type === "feat" || commit.type === "feature") {
      features += 1;
      if (level === 2 || level === undefined) {
        level = 1;
      }
    } else if (!isHiddenType && level === undefined) {
      level = 2;
    }
  });

  return {
    level,
    reason:
      breakings === 1 ? `There is ${breakings} BREAKING CHANGE and ${features} features` : `There are ${breakings} BREAKING CHANGES and ${features} features`
  };
}

function addBangNotes(commit) {
  const match = commit.header.match(/^(\w*)(?:\((.*)\))?!: (.*)$/);
  if (match && commit.notes.length === 0) {
    const noteText = match[3];
    commit.notes.push({ text: noteText });
  }
}
