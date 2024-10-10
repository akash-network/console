const parseArgs = require('yargs-parser');
const { addBangNotes } = require('conventional-changelog-conventionalcommits/utils')
const { DEFAULT_COMMIT_TYPES } = require("conventional-changelog-conventionalcommits");

const version = "${version}";
const packageName = process.env.npm_package_name;
const scope = packageName.split("/")[1];
const pathParts = process.env.npm_package_json.split('/');
const app = pathParts[pathParts.length - 2];

const options = parseArgs(process.argv, {
  string: ['repo', 'preRelease'],
  boolean: ['force-build'],
  alias: { r: 'repo', f: 'force-build' },
});

if (!options.repo) {
  console.error('"-r --repo" not specified');
  process.exit(1);
}

const isPromotion = !options.preRelease;

module.exports = {
  plugins: {
    "@release-it/conventional-changelog": {
      path: ".",
      infile: "CHANGELOG.md",
      preset: "conventionalcommits",
      gitRawCommitsOpts: {
        path: "."
      },
      tagPrefix: `${scope}/v`,
      skipUnstable: isPromotion,
      whatBump (commits) {
        let level = undefined
        let breakings = 0
        let features = 0

        commits.forEach(commit => {
          const isHiddenType = DEFAULT_COMMIT_TYPES.find((type) => type.type === commit.type)?.hidden || false;
          addBangNotes(commit)
          if (commit.notes.length > 0) {
            breakings += commit.notes.length
            level = 0
          } else if (commit.type === 'feat' || commit.type === 'feature') {
            features += 1
            if (level === 2 || typeof level === 'undefined') {
              level = 1
            }
          } else if (!isHiddenType && typeof level === 'undefined') {
            level = 2;
          }
        })

        return {
          level,
          reason: breakings === 1
              ? `There is ${breakings} BREAKING CHANGE and ${features} features`
              : `There are ${breakings} BREAKING CHANGES and ${features} features`
        };
      }
    }
  },
  git: {
    push: true,
    tagName: `${scope}/v${version}`,
    commitsPath: ".",
    commitMessage: `chore(release): released version ${scope}/v${version}`,
    requireCommits: !isPromotion,
    requireCommitsFail: false,
  },
  npm: {
    publish: false,
    versionArgs: ["--workspaces false"]
  },
  github: {
    release: true,
    releaseName: `${scope}/v${version}`
  },
  hooks: {
    'before:git:release': [
      `build-image -r ${options.repo} -t ${version} ${options.forceBuild ? '-f' : ''} -a ${app}`,
    ],
  }
};
