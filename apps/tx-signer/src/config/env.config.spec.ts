import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

const KEY_VERSION = "projects/console/locations/global/keyRings/tx-signer/cryptoKeys/funding/cryptoKeyVersions/1";
const OTHER_KEY_VERSION = "projects/console/locations/us-east1/keyRings/tx-signer/cryptoKeys/standby/cryptoKeyVersions/12";
const AUDIENCE = "//iam.googleapis.com/projects/1234/locations/global/workloadIdentityPools/console/providers/cluster";

describe("envSchema", () => {
  it("accepts the shipped defaults", () => {
    const result = envSchema.safeParse(setup());

    expect(result.success).toBe(true);
  });

  it("rejects an rpc request timeout that outlives the tx window it carries", () => {
    const result = envSchema.safeParse(setup({ RPC_REQUEST_TIMEOUT_MS: 30_000, UNORDERED_TX_TTL_MS: 30_000 }));

    expect(result.success).toBe(false);
    expect(result.error!.issues).toContainEqual(expect.objectContaining({ path: ["RPC_REQUEST_TIMEOUT_MS"] }));
  });

  it("rejects a signing deadline that cannot fit one whole attempt", () => {
    const result = envSchema.safeParse(setup({ SIGN_AND_BROADCAST_DEADLINE_MS: 40_000 }));

    expect(result.success).toBe(false);
    expect(result.error!.issues).toContainEqual(expect.objectContaining({ path: ["SIGN_AND_BROADCAST_DEADLINE_MS"] }));
  });

  describe("FUNDING_WALLET_KMS_KEY_VERSIONS", () => {
    it("names no key by default", () => {
      expect(envSchema.parse(setup()).FUNDING_WALLET_KMS_KEY_VERSIONS).toEqual([]);
    });

    it("splits the listed key versions and drops the blanks around them", () => {
      const env = envSchema.parse(
        setup({ FUNDING_WALLET_KMS_KEY_VERSIONS: ` ${KEY_VERSION} ,, ${OTHER_KEY_VERSION} `, GCP_WORKLOAD_IDENTITY_AUDIENCE: AUDIENCE })
      );

      expect(env.FUNDING_WALLET_KMS_KEY_VERSIONS).toEqual([KEY_VERSION, OTHER_KEY_VERSION]);
    });

    it.each([
      ["a key without a version", KEY_VERSION.replace("/cryptoKeyVersions/1", "")],
      ["a version that is not a number", KEY_VERSION.replace(/1$/, "latest")],
      ["text before the resource name", `x${KEY_VERSION}`],
      ["text after the resource name", `${KEY_VERSION}/x`],
      ["a valid name next to an invalid one", `${KEY_VERSION},not-a-key`]
    ])("rejects %s", (_case, value) => {
      const result = envSchema.safeParse(setup({ FUNDING_WALLET_KMS_KEY_VERSIONS: value, GCP_WORKLOAD_IDENTITY_AUDIENCE: AUDIENCE }));

      expect(result.success).toBe(false);
      expect(result.error!.issues).toContainEqual(
        expect.objectContaining({ path: ["FUNDING_WALLET_KMS_KEY_VERSIONS"], message: expect.stringContaining("cryptoKeyVersions/1") })
      );
    });

    it("rejects a key when no workload identity is configured to reach it", () => {
      const result = envSchema.safeParse(setup({ FUNDING_WALLET_KMS_KEY_VERSIONS: KEY_VERSION }));

      expect(result.success).toBe(false);
      expect(result.error!.issues).toContainEqual(
        expect.objectContaining({ path: ["GCP_WORKLOAD_IDENTITY_AUDIENCE"], message: expect.stringContaining("is required when") })
      );
    });
  });

  describe("GCP_WORKLOAD_IDENTITY_AUDIENCE", () => {
    it("is not required while no key is named", () => {
      expect(envSchema.parse(setup()).GCP_WORKLOAD_IDENTITY_AUDIENCE).toBeUndefined();
    });

    it.each([
      ["a project id instead of a project number", AUDIENCE.replace("/projects/1234/", "/projects/console/")],
      ["a pool without a provider", AUDIENCE.replace("/providers/cluster", "")],
      ["text before the audience", `https:${AUDIENCE}`],
      ["text after the audience", `${AUDIENCE}/x`]
    ])("rejects %s", (_case, value) => {
      const result = envSchema.safeParse(setup({ GCP_WORKLOAD_IDENTITY_AUDIENCE: value }));

      expect(result.success).toBe(false);
      expect(result.error!.issues).toContainEqual(
        expect.objectContaining({ path: ["GCP_WORKLOAD_IDENTITY_AUDIENCE"], message: expect.stringContaining("must look like") })
      );
    });
  });

  it("reads the workload's token from the directory the prod script allows by default", () => {
    expect(envSchema.parse(setup()).GCP_WORKLOAD_IDENTITY_TOKEN_FILE).toBe("/var/run/secrets/gcp-workload-identity/token");
  });

  it("rejects a KMS service account that is not an email address", () => {
    const result = envSchema.safeParse(setup({ GCP_KMS_SERVICE_ACCOUNT: "tx-signer" }));

    expect(result.success).toBe(false);
    expect(result.error!.issues).toContainEqual(expect.objectContaining({ path: ["GCP_KMS_SERVICE_ACCOUNT"] }));
  });

  function setup(overrides: Record<string, unknown> = {}) {
    return {
      ACCESS_API_KEY: faker.string.alphanumeric(32),
      FUNDING_WALLET_MNEMONIC_V2: faker.lorem.words(12),
      DERIVATION_WALLET_MNEMONIC_V2: faker.lorem.words(12),
      RPC_NODE_ENDPOINT: faker.internet.url(),
      ...overrides
    };
  }
});
