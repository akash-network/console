import "reflect-metadata";

import { Bip39, Random } from "@cosmjs/crypto";
import { container } from "tsyringe";

import { KMS_CLIENT } from "@src/providers/kms-client.provider";

import { createLocalKmsClient } from "@test/services/local-kms-client";

const TEST_MNEMONIC = Bip39.encode(Random.getBytes(32)).toString();

process.env.ACCESS_API_KEY = "functional-test-tx-signer-api-key-000000";
process.env.RPC_NODE_ENDPOINT = "http://localhost:26657";
process.env.FUNDING_WALLET_MNEMONIC_V2 = TEST_MNEMONIC;
process.env.DERIVATION_WALLET_MNEMONIC_V2 = TEST_MNEMONIC;
process.env.FUNDING_WALLET_KMS_KEY_VERSIONS = "projects/functional-test/locations/global/keyRings/tx-signer/cryptoKeys/funding/cryptoKeyVersions/1";
process.env.GCP_WORKLOAD_IDENTITY_AUDIENCE = "//iam.googleapis.com/projects/1/locations/global/workloadIdentityPools/functional-test/providers/cluster";

container.register(KMS_CLIENT, { useValue: createLocalKmsClient() });
