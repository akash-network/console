const parseArgs = require('yargs-parser');

const version = "${version}";
const packageName = process.env.npm_package_name;
const scope = packageName.split("/")[1];
const pathParts = process.env.npm_package_json.split('/');
const app = pathParts[pathParts.length - 2];

const options = parseArgs(process.argv, {
  string: ['repo'],
  boolean: ['force-build'],
  alias: { r: 'repo', f: 'force-build' },
});

if (!options.repo) {
  console.error('"-r --repo" not specified');
  process.exit(1);
}

module.exports = {
  plugins: {
    "@release-it/conventional-changelog": {
      path: ".",
      infile: "CHANGELOG.md",
      preset: "conventionalcommits",
      gitRawCommitsOpts: {
        path: "."
      },
      tagPrefix: `${scope}/v`
    }
  },
  git: {
    push: true,
    tagName: `${scope}/v${version}`,
    commitsPath: ".",
    commitMessage: `chore(release): released version ${scope}/v${version}`,
    requireCommits: true,
    requireCommitsFail: false,
    tagExclude: '<% print(typeof preRelease === "undefined" ? "*[-]*" : null) %>'
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
