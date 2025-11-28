const bip39 = require("bip39");

module.exports = {
  create: context => ({
    Literal(node) {
      if (typeof node.value === "string") {
        const mnemonicRegex = /^([a-z]{3,}\s+){11,23}[a-z]{3,}$/;
        const possibleMnemonic = node.value.trim();
        if (mnemonicRegex.test(possibleMnemonic) && bip39.validateMnemonic(possibleMnemonic)) {
          context.report({
            node,
            message:
              "Hardcoded mnemonic phrase detected. " +
              "Don't hardcode mnemonic phrases because it's impossible to distinguish whether it's production or test mnemonic. " +
              "Use generated mnemonic for test purposes and hide production mnemonic in secret store."
          });
        }
      }
    }
  })
};
