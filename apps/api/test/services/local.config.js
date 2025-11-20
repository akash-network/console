const dotenv = require("dotenv");

const { FUNDING_WALLET_INDEX } = dotenv.config({ path: "env/.env.funding-wallet-index" }).parsed || {};
const localConfig = dotenv.config({ path: "env/.env.functional.test" }).parsed || {};

let fundingWalletIndex;

if (!FUNDING_WALLET_INDEX) {
  throw new Error("FUNDING_WALLET_INDEX is not set in env");
}

fundingWalletIndex = parseInt(FUNDING_WALLET_INDEX);

if (isNaN(fundingWalletIndex)) {
  throw new Error("FUNDING_WALLET_INDEX is not a number");
}

module.exports = {
  localConfig: {
    FUNDING_WALLET_MNEMONIC: localConfig.FUNDING_WALLET_MNEMONIC,
    DERIVATION_WALLET_MNEMONIC: localConfig.DERIVATION_WALLET_MNEMONIC,
    FUNDING_WALLET_INDEX: fundingWalletIndex
  }
};
