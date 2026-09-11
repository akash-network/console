const dependenciesComponentOrHook = require("./rules/dependencies-component-or-hook");
const operationIdFormat = require("./rules/operation-id-format");

module.exports = {
  rules: {
    "operation-id-format": operationIdFormat,
    "dependencies-component-or-hook": dependenciesComponentOrHook
  }
};
