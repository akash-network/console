import dotenv from "dotenv";

const parsed = dotenv.config({ path: "env/.env.functional.test" }).parsed || {};

export const localConfig = {
  FUNDING_WALLET_MNEMONIC: parsed.FUNDING_WALLET_MNEMONIC,
  DERIVATION_WALLET_MNEMONIC: parsed.DERIVATION_WALLET_MNEMONIC,
  OLD_MASTER_WALLET_MNEMONIC: parsed.OLD_MASTER_WALLET_MNEMONIC
};
