const dependenciesComponentOrHook = require("./rules/dependencies-component-or-hook");
const noMnemonic = require("./rules/no-mnemonic");
const operationIdFormat = require("./rules/operation-id-format");

module.exports = {
  rules: {
    "no-mnemonic": noMnemonic,
    "operation-id-format": operationIdFormat,
    "dependencies-component-or-hook": dependenciesComponentOrHook
  }
};
