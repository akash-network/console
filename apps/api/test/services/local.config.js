const dotenv = require("dotenv");

const localConfig = dotenv.config({ path: "env/.env.functional.test" }).parsed || {};

module.exports = {
  localConfig: {
    FUNDING_WALLET_MNEMONIC: localConfig.FUNDING_WALLET_MNEMONIC,
    DERIVATION_WALLET_MNEMONIC: localConfig.DERIVATION_WALLET_MNEMONIC,
    OLD_MASTER_WALLET_MNEMONIC: localConfig.OLD_MASTER_WALLET_MNEMONIC
  }
};
