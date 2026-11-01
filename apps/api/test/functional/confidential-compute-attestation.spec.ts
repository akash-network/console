import { faker } from "@faker-js/faker";
import jwt from "jsonwebtoken";
import nock from "nock";
import crypto from "node:crypto";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { MAX_GPU_REPORTS, type VerifyAttestationResponse } from "@src/confidential-compute/http-schemas/attestation.schema";
import { CONFIDENTIAL_COMPUTE_CONFIG } from "@src/confidential-compute/providers/config.provider";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

const NONCE = Buffer.alloc(64, 0x5a).toString("base64");
const GPU_NONCE_HEX = Buffer.from(NONCE, "base64").subarray(0, 32).toString("hex");
const GPU_REPORT = Buffer.concat([
  Buffer.from("GH100-spdm-evidence"),
  Buffer.from("-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----\n")
]).toString("base64");

describe("Confidential compute attestation", () => {
  const { NVIDIA_NRAS_BASE_URL, NVIDIA_NRAS_JWKS_URL } = container.resolve(CONFIDENTIAL_COMPUTE_CONFIG);
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  describe("POST /v1/confidential-compute/attestation/validate", () => {
    it("returns 401 without calling NVIDIA when the caller is not signed in", async () => {
      const nvidia = mockNvidia();

      const response = await validate(undefined, attestationBody(gpuReports(2)));

      expect(response.status).toBe(401);
      expect(nvidia.calls()).toEqual({ attestations: 0, keyFetches: 0 });
    });

    it(`returns 400 without calling NVIDIA when the request carries more than ${MAX_GPU_REPORTS} GPU reports`, async () => {
      const { token } = await setup();
      const nvidia = mockNvidia();

      const response = await validate(token, attestationBody(gpuReports(MAX_GPU_REPORTS + 1)));

      expect(response.status).toBe(400);
      expect(nvidia.calls()).toEqual({ attestations: 0, keyFetches: 0 });
    });

    it("returns 400 without calling NVIDIA when two GPU reports name the same device", async () => {
      const { token } = await setup();
      const nvidia = mockNvidia();

      const response = await validate(token, attestationBody([...gpuReports(2), { device_index: 1, report: GPU_REPORT }]));

      expect(response.status).toBe(400);
      expect(nvidia.calls()).toEqual({ attestations: 0, keyFetches: 0 });
    });

    it("verifies every GPU report while fetching NVIDIA's signing keys once", async () => {
      const { token } = await setup();
      const nvidia = mockNvidia();

      const response = await validate(token, attestationBody(gpuReports(MAX_GPU_REPORTS)));
      const result = (await response.json()) as VerifyAttestationResponse;

      expect(response.status).toBe(200);
      expect(result.reports.filter(report => report.kind === "gpu").map(report => report.status)).toEqual(Array(MAX_GPU_REPORTS).fill("valid"));
      expect(nvidia.calls()).toEqual({ attestations: MAX_GPU_REPORTS, keyFetches: 1 });
    });
  });

  function mockNvidia() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-384" });
    const eat = jwt.sign({ "x-nvidia-overall-att-result": true, eat_nonce: GPU_NONCE_HEX }, privateKey.export({ type: "pkcs8", format: "pem" }), {
      algorithm: "ES384",
      keyid: "nras-test"
    });
    const jwks = { keys: [{ ...publicKey.export({ format: "jwk" }), kid: "nras-test", alg: "ES384" }] };
    const jwksUrl = new URL(NVIDIA_NRAS_JWKS_URL);
    let attestations = 0;
    let keyFetches = 0;

    nock(NVIDIA_NRAS_BASE_URL)
      .persist()
      .post("/v3/attest/gpu")
      .reply(200, () => {
        attestations++;
        return [["JWT", eat], {}];
      });
    nock(jwksUrl.origin)
      .persist()
      .get(jwksUrl.pathname)
      .reply(200, () => {
        keyFetches++;
        return jwks;
      });

    return { calls: () => ({ attestations, keyFetches }) };
  }

  async function validate(token: string | undefined, body: Record<string, unknown>) {
    return await app.request("/v1/confidential-compute/attestation/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body)
    });
  }

  function attestationBody(reports: Array<{ device_index: number; report: string }>) {
    return { nonce: NONCE, report: Buffer.from("short-snp-report").toString("base64"), tee_platform: "snp-gpu", gpu_reports: reports };
  }

  function gpuReports(count: number) {
    return Array.from({ length: count }, (_, deviceIndex) => ({ device_index: deviceIndex, report: GPU_REPORT }));
  }

  async function setup() {
    const user = await userRepository.create({ userId: faker.string.uuid(), username: `user-${faker.string.alphanumeric(12)}`, email: faker.internet.email() });
    const token = faker.string.alphanumeric(40);

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header => (header.replace(/^Bearer +/i, "") === token ? user.userId! : null));

    return { user, token };
  }
});
