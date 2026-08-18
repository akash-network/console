import "reflect-metadata";

import { Bip39, Random } from "@cosmjs/crypto";

const TEST_MNEMONIC = Bip39.encode(Random.getBytes(32)).toString();

process.env.ACCESS_API_KEY = "functional-test-tx-signer-api-key-000000";
process.env.RPC_NODE_ENDPOINT = "http://localhost:26657";
process.env.FUNDING_WALLET_MNEMONIC_V2 = TEST_MNEMONIC;
process.env.DERIVATION_WALLET_MNEMONIC_V2 = TEST_MNEMONIC;
