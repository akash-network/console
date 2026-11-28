import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { envSchema } from "./env.config";

const KEY_VERSION = "projects/console/locations/global/keyRings/tx-signer/cryptoKeys/funding/cryptoKeyVersions/1";
const OTHER_KEY_VERSION = "projects/console/locations/us-east1/keyRings/tx-signer/cryptoKeys/standby/cryptoKeyVersions/12";
const SEED_KEY = "projects/console/locations/global/keyRings/tx-signer/cryptoKeys/derivation-seed";
const CIPHERTEXT = "CiQAq1Zx+abc/DEF0123456789==";
const OTHER_CIPHERTEXT = "CiQBzzzz+xyz/UVW9876543210";
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

  describe("derivation seeds", () => {
    it("holds no encrypted seed by default and takes the readable current one", () => {
      const env = envSchema.parse(setup());

      expect(env.DERIVATION_WALLET_SEEDS_ENCRYPTED).toEqual({});
      expect(env.DERIVATION_SEED_KMS_KEY).toBeUndefined();
    });

    it("reads the encrypted seeds by version, dropping the blanks around them", () => {
      const env = envSchema.parse(encryptedSetup({ DERIVATION_WALLET_SEEDS_ENCRYPTED: ` v2:${CIPHERTEXT} ,, v3:${OTHER_CIPHERTEXT} ` }));

      expect(env.DERIVATION_WALLET_SEEDS_ENCRYPTED).toEqual({ v2: CIPHERTEXT, v3: OTHER_CIPHERTEXT });
    });

    it("accepts a signer whose current seed exists only encrypted", () => {
      const result = envSchema.safeParse(encryptedSetup({ DERIVATION_WALLET_SEEDS_ENCRYPTED: `v2:${CIPHERTEXT}` }));

      expect(result.success).toBe(true);
    });

    it("accepts an added encrypted seed next to the readable current one", () => {
      const result = envSchema.safeParse(
        encryptedSetup({ DERIVATION_WALLET_MNEMONIC_V2: faker.lorem.words(12), DERIVATION_WALLET_SEEDS_ENCRYPTED: `v3:${CIPHERTEXT}` })
      );

      expect(result.success).toBe(true);
    });

    it.each([
      ["ends on a whole group", "CiQAq1Zx"],
      ["ends on two characters and their padding", "CiQAq1ZxAB=="],
      ["ends on two characters without padding", "CiQAq1ZxAB"],
      ["ends on three characters and their padding", "CiQAq1ZxABC="],
      ["ends on three characters without padding", "CiQAq1ZxABC"]
    ])("accepts a ciphertext that %s", (_case, ciphertext) => {
      const env = envSchema.parse(encryptedSetup({ DERIVATION_WALLET_SEEDS_ENCRYPTED: `v2:${ciphertext}` }));

      expect(env.DERIVATION_WALLET_SEEDS_ENCRYPTED).toEqual({ v2: ciphertext });
    });

    it.each([
      ["a pair without a version", `:${CIPHERTEXT}`],
      ["a pair without a ciphertext", "v3:"],
      ["a version alone", "v3"],
      ["a version numbered zero", `v0:${CIPHERTEXT}`],
      ["a version with text before it", `xv3:${CIPHERTEXT}`],
      ["a ciphertext that is not base64", "v3:not base64!"],
      ["a ciphertext with text after its padding", `v3:${CIPHERTEXT}x`],
      ["a ciphertext too short to hold a byte", "v3:A"],
      ["a ciphertext shorter than one group", "v3:AB=="],
      ["a ciphertext cut one character into a group", "v3:CiQAq1ZxA"],
      ["a ciphertext padded after a whole group", "v3:CiQAq1Zx=="],
      ["a ciphertext with one padding sign where two belong", "v3:CiQAq1ZxAB="],
      ["a ciphertext with two padding signs where one belongs", "v3:CiQAq1ZxABC=="],
      ["a pair with a third part", `v3:${CIPHERTEXT}:${CIPHERTEXT}`],
      ["a valid pair next to an invalid one", `v2:${CIPHERTEXT},v3`]
    ])("rejects %s", (_case, value) => {
      const result = envSchema.safeParse(encryptedSetup({ DERIVATION_WALLET_SEEDS_ENCRYPTED: value }));

      expect(result.success).toBe(false);
      expect(result.error!.issues).toContainEqual(
        expect.objectContaining({ path: ["DERIVATION_WALLET_SEEDS_ENCRYPTED"], message: expect.stringContaining("must list pairs like") })
      );
    });

    it("rejects a seed version listed twice", () => {
      const result = envSchema.safeParse(encryptedSetup({ DERIVATION_WALLET_SEEDS_ENCRYPTED: `v2:${CIPHERTEXT},v2:${OTHER_CIPHERTEXT}` }));

      expect(result.success).toBe(false);
      expect(result.error!.issues).toContainEqual(
        expect.objectContaining({ path: ["DERIVATION_WALLET_SEEDS_ENCRYPTED"], message: expect.stringContaining("each seed version once") })
      );
    });

    it("rejects encrypted seeds without the key that decrypts them", () => {
      const result = envSchema.safeParse(encryptedSetup({ DERIVATION_WALLET_SEEDS_ENCRYPTED: `v2:${CIPHERTEXT}`, DERIVATION_SEED_KMS_KEY: undefined }));

      expect(result.success).toBe(false);
      expect(result.error!.issues).toContainEqual(
        expect.objectContaining({ path: ["DERIVATION_SEED_KMS_KEY"], message: expect.stringContaining("is required when") })
      );
    });

    it("rejects encrypted seeds without a workload identity to reach the key with", () => {
      const result = envSchema.safeParse(encryptedSetup({ DERIVATION_WALLET_SEEDS_ENCRYPTED: `v2:${CIPHERTEXT}`, GCP_WORKLOAD_IDENTITY_AUDIENCE: undefined }));

      expect(result.success).toBe(false);
      expect(result.error!.issues).toContainEqual(
        expect.objectContaining({
          path: ["GCP_WORKLOAD_IDENTITY_AUDIENCE"],
          message: expect.stringContaining("DERIVATION_WALLET_SEEDS_ENCRYPTED holds a seed")
        })
      );
    });

    it("asks for neither the key nor a workload identity while no seed is encrypted", () => {
      const result = envSchema.safeParse(setup());

      expect(result.success).toBe(true);
    });

    it.each([
      ["current", { DERIVATION_WALLET_MNEMONIC_V2: faker.lorem.words(12), DERIVATION_WALLET_SEEDS_ENCRYPTED: `v2:${CIPHERTEXT}` }, "v2"],
      [
        "first-generation",
        { DERIVATION_WALLET_MNEMONIC_V1: faker.lorem.words(12), DERIVATION_WALLET_SEEDS_ENCRYPTED: `v1:${CIPHERTEXT},v2:${CIPHERTEXT}` },
        "v1"
      ]
    ])("rejects a %s seed given both readable and encrypted", (_case, overrides, version) => {
      const result = envSchema.safeParse(encryptedSetup(overrides));

      expect(result.success).toBe(false);
      expect(result.error!.issues).toContainEqual(
        expect.objectContaining({
          path: ["DERIVATION_WALLET_SEEDS_ENCRYPTED"],
          message: `Derivation seed ${version} is given both readable and encrypted, and only one of them can be the seed`
        })
      );
    });

    it("rejects a signer with no current seed, readable or encrypted", () => {
      const result = envSchema.safeParse(encryptedSetup({ DERIVATION_WALLET_SEEDS_ENCRYPTED: `v3:${CIPHERTEXT}` }));

      expect(result.success).toBe(false);
      expect(result.error!.issues).toContainEqual(
        expect.objectContaining({ path: ["DERIVATION_WALLET_SEEDS_ENCRYPTED"], message: expect.stringContaining("Derivation seed v2 is required") })
      );
    });

    it.each([
      ["a key version instead of a key", `${SEED_KEY}/cryptoKeyVersions/1`],
      ["a key ring without a key", SEED_KEY.replace("/cryptoKeys/derivation-seed", "")],
      ["text before the resource name", `x${SEED_KEY}`]
    ])("rejects %s as the seed key", (_case, value) => {
      const result = envSchema.safeParse(encryptedSetup({ DERIVATION_WALLET_SEEDS_ENCRYPTED: `v2:${CIPHERTEXT}`, DERIVATION_SEED_KMS_KEY: value }));

      expect(result.success).toBe(false);
      expect(result.error!.issues).toContainEqual(
        expect.objectContaining({ path: ["DERIVATION_SEED_KMS_KEY"], message: expect.stringContaining("must look like") })
      );
    });

    function encryptedSetup(overrides: Record<string, unknown> = {}) {
      return setup({ DERIVATION_WALLET_MNEMONIC_V2: undefined, DERIVATION_SEED_KMS_KEY: SEED_KEY, GCP_WORKLOAD_IDENTITY_AUDIENCE: AUDIENCE, ...overrides });
    }
  });

  describe("funding controls database", () => {
    it("leaves the funding controls off for a signer given no database", () => {
      expect(envSchema.parse(setup()).FUNDING_CONTROLS_POSTGRES_URL).toBeUndefined();
    });

    it("reads the database the funding controls live in, with five connections unless told otherwise", () => {
      const env = envSchema.parse(setup({ FUNDING_CONTROLS_POSTGRES_URL: "postgres://signer@db.internal:5432/signer_controls" }));

      expect(env.FUNDING_CONTROLS_POSTGRES_URL).toBe("postgres://signer@db.internal:5432/signer_controls");
      expect(env.FUNDING_CONTROLS_POSTGRES_MAX_CONNECTIONS).toBe(5);
    });

    it("reads a connection limit given as text", () => {
      expect(envSchema.parse(setup({ FUNDING_CONTROLS_POSTGRES_MAX_CONNECTIONS: "2" })).FUNDING_CONTROLS_POSTGRES_MAX_CONNECTIONS).toBe(2);
    });

    it.each([
      ["a database that is not a URL", { FUNDING_CONTROLS_POSTGRES_URL: "signer_controls" }, "FUNDING_CONTROLS_POSTGRES_URL"],
      ["no connection at all", { FUNDING_CONTROLS_POSTGRES_MAX_CONNECTIONS: "0" }, "FUNDING_CONTROLS_POSTGRES_MAX_CONNECTIONS"],
      ["a fraction of a connection", { FUNDING_CONTROLS_POSTGRES_MAX_CONNECTIONS: "1.5" }, "FUNDING_CONTROLS_POSTGRES_MAX_CONNECTIONS"]
    ])("rejects %s", (_case, overrides, path) => {
      const result = envSchema.safeParse(setup(overrides));

      expect(result.success).toBe(false);
      expect(result.error!.issues).toContainEqual(expect.objectContaining({ path: [path] }));
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
