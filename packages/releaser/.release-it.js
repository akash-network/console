const { addBangNotes } = require("conventional-changelog-conventionalcommits/utils");

const version = "${version}";
const packageName = process.env.npm_package_name;
const scope = packageName.split("/")[1];
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

module.exports = {
  plugins: {
    "@release-it/conventional-changelog": {
      path: ".",
      infile: "CHANGELOG.md",
      preset: {
        name: "conventionalcommits",
        types: COMMIT_TYPES
      },
      gitRawCommitsOpts: {
        path: "."
      },
      tagPrefix: `${scope}/v`,
      whatBump(commits) {
        let level = undefined;
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
            if (level === 2 || typeof level === "undefined") {
              level = 1;
            }
          } else if (!isHiddenType && typeof level === "undefined") {
            level = 2;
          }
        });

        return {
          level,
          reason:
            breakings === 1
              ? `There is ${breakings} BREAKING CHANGE and ${features} features`
              : `There are ${breakings} BREAKING CHANGES and ${features} features`
        };
      }
    }
  },
  git: {
    push: false,
    tag: false,
    tagName: `${scope}/v${version}`,
    commitsPath: ".",
    commitMessage: `chore(release): released version ${scope}/v${version}`,
    requireCommitsFail: false,
    commit: false,
    requireCleanWorkingDir: false
  },
  npm: {
    publish: false,
    versionArgs: ["--workspaces false"]
  }
};
