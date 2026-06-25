import type { HttpClient } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { envSchema } from "../../config/env.config";
import type { Jwks } from "../jwt-verify";
import { detectGpuArch, extractAttestationResult, extractEat, NvidiaGpuService, splitGpuReport } from "./nvidia-gpu.service";

const FAKE_CERT_PEM = "-----BEGIN CERTIFICATE-----\nMIIBfakecert\n-----END CERTIFICATE-----\n";

describe(NvidiaGpuService.name, () => {
  describe(splitGpuReport.name, () => {
    it("splits the report into binary evidence and the trailing PEM cert chain", () => {
      const evidence = Buffer.from("spdm-evidence-bytes");
      const report = Buffer.concat([evidence, Buffer.from(FAKE_CERT_PEM)]);

      const split = splitGpuReport(report);

      expect(split?.evidence).toEqual(evidence);
      expect(split?.certChainPem.startsWith("-----BEGIN CERTIFICATE-----")).toBe(true);
    });

    it("returns null when the report has no embedded certificate", () => {
      expect(splitGpuReport(Buffer.from("no-cert-here"))).toBeNull();
    });
  });

  describe(detectGpuArch.name, () => {
    it("detects Blackwell from a GB2xx marker", () => {
      expect(detectGpuArch(Buffer.from("...GB202..."))).toBe("BLACKWELL");
    });

    it("defaults to Hopper", () => {
      expect(detectGpuArch(Buffer.from("...H100..."))).toBe("HOPPER");
    });
  });

  describe(extractEat.name, () => {
    it("reads the token from a string or the first tuple element", () => {
      expect(extractEat("jwt-token")).toBe("jwt-token");
      expect(extractEat(["overall-token", { "GPU-0": "x" }])).toBe("overall-token");
      expect(extractEat({ unexpected: true })).toBeNull();
    });
  });

  describe(extractAttestationResult.name, () => {
    it("reads boolean and string result claims, and is undefined when absent", () => {
      expect(extractAttestationResult({ "x-nvidia-overall-att-result": true })).toBe(true);
      expect(extractAttestationResult({ measres: "success" })).toBe(true);
      expect(extractAttestationResult({ measres: "comparison-failed" })).toBe(false);
      expect(extractAttestationResult({ unrelated: 1 })).toBeUndefined();
    });
  });

  describe("verify", () => {
    it("returns valid when NRAS attests the GPU and the EAT verifies", async () => {
      const { token, jwks } = await signEat({ "x-nvidia-overall-att-result": true });
      const { service, httpClient } = setup({ eat: token, jwks });

      const verdict = await service.verify({ deviceIndex: 0, report: gpuReport(), nonce: nonce64() });

      expect(verdict).toMatchObject({ kind: "gpu", device_index: 0, vendor: "nvidia", status: "valid" });
      const [path, body] = httpClient.post.mock.calls[0];
      expect(path).toBe("/v3/attest/gpu");
      expect((body as { nonce: string }).nonce).toHaveLength(64); // 32 bytes hex
      expect((body as { evidence_list: unknown[] }).evidence_list).toHaveLength(1);
    });

    it("returns invalid when NRAS rejects the GPU evidence", async () => {
      const { token, jwks } = await signEat({ "x-nvidia-overall-att-result": false });
      const { service } = setup({ eat: token, jwks });

      const verdict = await service.verify({ deviceIndex: 1, report: gpuReport(), nonce: nonce64() });

      expect(verdict).toMatchObject({ device_index: 1, status: "invalid" });
    });

    it("returns unverifiable without calling NRAS when the report has no certificate", async () => {
      const { service, httpClient } = setup({});

      const verdict = await service.verify({ deviceIndex: 0, report: Buffer.from("no-cert").toString("base64"), nonce: nonce64() });

      expect(verdict.status).toBe("unverifiable");
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it("returns unverifiable when the EAT signature cannot be verified against the JWKS", async () => {
      const { token } = await signEat({ "x-nvidia-overall-att-result": true });
      const { jwks: otherJwks } = await signEat({}); // unrelated key set
      const { service } = setup({ eat: token, jwks: otherJwks });

      const verdict = await service.verify({ deviceIndex: 0, report: gpuReport(), nonce: nonce64() });

      expect(verdict.status).toBe("unverifiable");
    });

    it("returns unverifiable when the EAT carries no recognizable result claim", async () => {
      const { token, jwks } = await signEat({ "x-nvidia-ver": "3.0" });
      const { service } = setup({ eat: token, jwks });

      const verdict = await service.verify({ deviceIndex: 0, report: gpuReport(), nonce: nonce64() });

      expect(verdict.status).toBe("unverifiable");
    });

    it("propagates NRAS transport errors so the orchestrator can mark the report unverifiable", async () => {
      const { service, httpClient } = setup({});
      httpClient.post.mockRejectedValue(new Error("NRAS unreachable"));

      await expect(service.verify({ deviceIndex: 0, report: gpuReport(), nonce: nonce64() })).rejects.toThrow("NRAS unreachable");
    });
  });

  function setup(input: { eat?: string; jwks?: Jwks }) {
    const httpClient = mock<HttpClient>();
    if (input.eat) httpClient.post.mockResolvedValue({ data: input.eat });
    if (input.jwks) httpClient.get.mockResolvedValue({ data: input.jwks });
    const service = new NvidiaGpuService(httpClient, envSchema.parse({}), mock<LoggerService>());
    return { service, httpClient };
  }
});

function gpuReport(): string {
  return Buffer.concat([Buffer.from("GB202-spdm-evidence"), Buffer.from(FAKE_CERT_PEM)]).toString("base64");
}

function nonce64(): string {
  return Buffer.alloc(64, 0x5a).toString("base64");
}

function signEat(claims: Record<string, unknown>): { token: string; jwks: Jwks } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-384" });
  const token = jwt.sign(claims, privateKey.export({ type: "pkcs8", format: "pem" }), { algorithm: "ES384", keyid: "nras-test" });
  const jwk = publicKey.export({ format: "jwk" });
  return { token, jwks: { keys: [{ ...jwk, kid: "nras-test", alg: "ES384" }] } };
}
