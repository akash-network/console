/**
 * DO NOT use non-builtin node modules in this file and keep it as simple as possible.
 * Because this function is also used in a github action .github/actions/local-dependencies/action.yml
 */

const fs = require("fs");
const path = require("path");

/**
 * @param {string} releaseablePackageDirectory
 * @returns {string[]}
 */
function findLocalPackageDependencies(releaseablePackageDirectory) {
  const releaseablePackageJsonPath = path.join(releaseablePackageDirectory, "package.json");
  if (!fs.existsSync(releaseablePackageJsonPath)) return [];

  const releaseablePackage = JSON.parse(fs.readFileSync(releaseablePackageJsonPath, "utf8"));
  const dependencies = {
    "@akashnetwork/docker": "*",
    "@akashnetwork/releaser": "*",
    ...releaseablePackage.dependencies,
    ...releaseablePackage.devDependencies
  };
  if (!Object.keys(dependencies).length) return [];

  const packagesPath = path.join(releaseablePackageDirectory, "..", "..", "packages");
  const allLocalPackagesNames = fs.readdirSync(packagesPath).map(package => {
    const packageJsonPath = path.join(packagesPath, package, "package.json");
    if (!fs.existsSync(packageJsonPath)) return "";
    return {
      name: JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).name,
      path: path.dirname(packageJsonPath)
    };
  });

  return allLocalPackagesNames.filter(package => dependencies[package.name]).map(package => package.path);
}

module.exports = findLocalPackageDependencies;
