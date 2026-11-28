import "reflect-metadata";

import { Bip39, Random } from "@cosmjs/crypto";
import { container } from "tsyringe";
import { afterAll, expect } from "vitest";

import { KMS_CLIENT } from "@src/providers/kms-client.provider";
import { DerivationSeedService } from "@src/services/derivation-seed/derivation-seed.service";
import { FundingFreezeService } from "@src/services/funding-freeze/funding-freeze.service";

import { createLocalKmsClient } from "@test/services/local-kms-client";
import { TestDatabaseService } from "@test/services/test-database.service";

const TEST_MNEMONIC = Bip39.encode(Random.getBytes(32)).toString();

process.env.ACCESS_API_KEY = "functional-test-tx-signer-api-key-000000";
process.env.RPC_NODE_ENDPOINT = "http://localhost:26657";
process.env.FUNDING_WALLET_MNEMONIC_V2 = TEST_MNEMONIC;
process.env.DERIVATION_WALLET_MNEMONIC_V2 = TEST_MNEMONIC;
process.env.DERIVATION_WALLET_MNEMONIC_V1 = Bip39.encode(Random.getBytes(32)).toString();
process.env.FUNDING_WALLET_KMS_KEY_VERSIONS = "projects/functional-test/locations/global/keyRings/tx-signer/cryptoKeys/funding/cryptoKeyVersions/1";
process.env.GCP_WORKLOAD_IDENTITY_AUDIENCE = "//iam.googleapis.com/projects/1/locations/global/workloadIdentityPools/functional-test/providers/cluster";

const kmsClient = createLocalKmsClient();
const addedSeedPhrase = Bip39.encode(Random.getBytes(32)).toString();
process.env.DERIVATION_SEED_KMS_KEY = "projects/functional-test/locations/global/keyRings/tx-signer/cryptoKeys/derivation-seed";
process.env.DERIVATION_WALLET_SEEDS_ENCRYPTED = `v3:${Buffer.from(kmsClient.encrypt(addedSeedPhrase)).toString("base64")}`;

const testDatabase = new TestDatabaseService(expect.getState().testPath ?? "functional");
process.env.FUNDING_CONTROLS_POSTGRES_URL = testDatabase.url;
await testDatabase.setup();
afterAll(() => testDatabase.teardown());

container.register(KMS_CLIENT, { useValue: kmsClient });
await container.resolve(DerivationSeedService).load();
await container.resolve(FundingFreezeService).load();
