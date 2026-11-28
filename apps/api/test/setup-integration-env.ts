import "reflect-metadata";

import { Bip39, Random } from "@cosmjs/crypto";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import { container } from "tsyringe";

import { RAW_APP_CONFIG } from "@src/core/providers/raw-app-config.provider";

dotenvExpand.expand(dotenv.config({ path: "env/.env.functional.test" }));

for (const seedPhraseKey of ["FUNDING_WALLET_MNEMONIC", "DERIVATION_WALLET_MNEMONIC", "OLD_MASTER_WALLET_MNEMONIC"]) {
  process.env[seedPhraseKey] ??= Bip39.encode(Random.getBytes(32)).toString();
}

container.register(RAW_APP_CONFIG, { useValue: process.env });
