const noMnemonic = require("./rules/no-mnemonic");
const operationIdFormat = require("./rules/operation-id-format");

module.exports = {
  rules: {
    "no-mnemonic": noMnemonic,
    "operation-id-format": operationIdFormat
  }
};
