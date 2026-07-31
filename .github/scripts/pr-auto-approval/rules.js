const { parse } = require("./codeowners");

const APPROVABLE_TYPE_PATTERN = /^(chore|test|docs|fix|refactor)[:(]/;
const ALLOWED_SIZE_LABELS = ["size: XS", "size: S", "size: M"];
const TEST_FILE_PATTERN = /(\.(spec|test|integration|e2e)\.[cm]?[jt]sx?$)|(^|\/)tests?\//;
const TEST_CONFIG_PATTERN = /(jest|vitest|playwright)\.config\.[tj]s$/;
const IMAGE_FILE_PATTERN = /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp)$/i;
const SOURCE_CODE_PATTERN = /^(apps|packages)\/.*\.[cm]?[jt]sx?$/;
const MAX_REPORTED_FILES = 5;

function evaluate({ title, labels, authorLogin, headRepo, baseRepo, isDraft, files, codeownersContent }) {
  const ineligible = findIneligibilityReason({ title, labels, authorLogin, headRepo, baseRepo, isDraft });
  if (ineligible) {
    return { outcome: "ineligible", reason: ineligible };
  }

  const type = title.match(APPROVABLE_TYPE_PATTERN)[1];
  const blockers = collectBlockers({ type, files, codeownersContent });
  if (blockers.length > 0) {
    return { outcome: "blocked", blockers };
  }

  const scopeMiss = findScopeMiss({ type, files });
  if (scopeMiss) {
    return { outcome: "skipped", reason: scopeMiss };
  }

  return { outcome: "approved", reason: APPROVAL_REASONS[type] };
}

const APPROVAL_REASONS = {
  chore: "chore that does not touch source code files",
  test: "all changes are related to tests",
  docs: "all changes are related to documentation",
  fix: "bug fix within approved scope that includes test changes",
  refactor: "refactor within approved scope"
};

function findIneligibilityReason({ title, labels, authorLogin, headRepo, baseRepo, isDraft }) {
  if (headRepo && headRepo !== baseRepo) {
    return "PR is from a fork";
  }
  if (/bot/i.test(authorLogin)) {
    return `author "${authorLogin}" appears to be a bot`;
  }
  if (isDraft) {
    return "PR is a draft";
  }
  if (!labels.includes("experienced-contributor")) {
    return "missing experienced-contributor label";
  }
  if (!APPROVABLE_TYPE_PATTERN.test(title)) {
    return "title type is not one of: chore, test, docs, fix, refactor";
  }
  if (!ALLOWED_SIZE_LABELS.some(size => labels.includes(size))) {
    return "missing required size label (XS, S, or M)";
  }
  return null;
}

function collectBlockers({ type, files, codeownersContent }) {
  const blockers = [];

  const ownedFiles = findCodeOwnedFiles(files, codeownersContent);
  if (ownedFiles.length > 0) {
    blockers.push({
      id: "code-owned-paths",
      message: "These files are on code-owned paths and require @akash-network/console review",
      files: ownedFiles.slice(0, MAX_REPORTED_FILES)
    });
  }

  if (type === "fix" && !hasRegressionTestEvidence(files)) {
    blockers.push({
      id: "missing-regression-test",
      message: "Bug fixes must add or update at least one test file as regression evidence",
      files: []
    });
  }

  return blockers;
}

function findCodeOwnedFiles(files, codeownersContent) {
  const owners = parse(codeownersContent);
  return files.filter(file => owners.isOwned(file.filename) || (file.previous_filename && owners.isOwned(file.previous_filename))).map(file => file.filename);
}

function hasRegressionTestEvidence(files) {
  return files.some(file => {
    if (!TEST_FILE_PATTERN.test(file.filename)) {
      return false;
    }
    if (file.status === "added" || file.status === "modified") {
      return true;
    }
    return file.status === "renamed" && file.changes > 0;
  });
}

function findScopeMiss({ type, files }) {
  const filenames = files.map(file => file.filename);

  if (type === "test" && !filenames.every(f => TEST_FILE_PATTERN.test(f) || TEST_CONFIG_PATTERN.test(f))) {
    return "PR changes non-test files";
  }
  if (type === "docs" && !filenames.every(f => f.endsWith(".md") || IMAGE_FILE_PATTERN.test(f))) {
    return "PR changes non-documentation files";
  }
  if (type === "chore" && filenames.some(f => SOURCE_CODE_PATTERN.test(f))) {
    return "PR touches code files in packages/ or apps/";
  }
  return null;
}

module.exports = { evaluate };
