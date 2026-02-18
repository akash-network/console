import { Bumper } from "conventional-recommended-bump";
import { parseArgs } from "node:util";

import { findLocalPackageDependencies } from "./find-local-package-dependencies.js";

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

const breakingHeaderPattern = /^(\w*)(?:\((.*)\))?!: (.*)$/;

function addBangNotes(commit) {
  const match = commit.header.match(breakingHeaderPattern);
  if (match && commit.notes.length === 0) {
    commit.notes.push({ text: match[3] });
  }
}

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

function generateChangelog(commits, { repoUrl, lastTag, nextTag, nextVersion }) {
  const date = new Date().toISOString().split("T")[0];
  const compareUrl = lastTag ? `${repoUrl}/compare/${lastTag}...${nextTag}` : `${repoUrl}/commits/${nextTag}`;

  const lines = [`## [${nextVersion}](${compareUrl}) (${date})`];

  const sections = new Map();

  for (const commit of commits) {
    const typeConfig = COMMIT_TYPES.find(t => t.type === commit.type);
    if (!typeConfig || typeConfig.hidden) continue;

    if (!sections.has(typeConfig.section)) {
      sections.set(typeConfig.section, []);
    }

    const scope = commit.scope ? `**${commit.scope}:** ` : "";
    const hash = commit.hash ? commit.hash.substring(0, 7) : "";
    const hashLink = hash ? ` ([${hash}](${repoUrl}/commit/${commit.hash}))` : "";

    let subject = commit.subject || "";
    let prLink = "";
    const prMatch = subject.match(/\(#(\d+)\)$/);
    if (prMatch) {
      subject = subject.replace(/\s*\(#\d+\)$/, "");
      prLink = ` ([#${prMatch[1]}](${repoUrl}/issues/${prMatch[1]}))`;
    }

    sections.get(typeConfig.section).push(`* ${scope}${subject}${prLink}${hashLink}`);
  }

  for (const commit of commits) {
    if (commit.notes.length === 0) continue;
    if (!sections.has("BREAKING CHANGES")) {
      sections.set("BREAKING CHANGES", []);
    }
    for (const note of commit.notes) {
      sections.get("BREAKING CHANGES").push(`* ${note.text}`);
    }
  }

  for (const [section, entries] of sections) {
    lines.push("", "", `### ${section}`, "");
    lines.push(...entries);
  }

  return lines.join("\n");
}

const { values } = parseArgs({
  options: {
    "tag-prefix": { type: "string" },
    "repo-url": { type: "string" },
    path: { type: "string" }
  }
});

const bumper = new Bumper(process.cwd());

bumper.loadPreset("conventionalcommits");

if (values["tag-prefix"]) {
  bumper.tag({ prefix: values["tag-prefix"] });
}

if (values.path?.length) {
  const additionalPaths = findLocalPackageDependencies(values.path);
  bumper.commits({ path: [values.path, ...additionalPaths] });
}

const lastTag = await bumper.getLastSemverTag();
const result = await bumper.bump(whatBump);

if (!result.releaseType) {
  console.error(JSON.stringify({ error: "No releasable commits found" }));
  process.exit(0);
}

const prefix = values["tag-prefix"] || "";
const currentVersion = lastTag ? lastTag.replace(prefix, "") : "0.0.0";
const [major, minor, patch] = currentVersion.split(".").map(Number);

let nextVersion;
switch (result.releaseType) {
  case "major":
    nextVersion = `${major + 1}.0.0`;
    break;
  case "minor":
    nextVersion = `${major}.${minor + 1}.0`;
    break;
  default:
    nextVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

const nextTag = `${prefix}${nextVersion}`;
const repoUrl = values["repo-url"] || "";
const changelog = generateChangelog([result.commits[0]], { repoUrl, lastTag, nextTag, nextVersion });

console.log(
  JSON.stringify({
    releaseType: result.releaseType,
    currentVersion,
    nextVersion,
    nextTag,
    changelog
  })
);
