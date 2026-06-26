import type { HttpClient } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ConfidentialComputeConfig } from "../../config/env.config";
import { envSchema } from "../../config/env.config";
import type { Jwks } from "../jwt-verify";
import { extractTdxResult, IntelTdxService, nonceBinding } from "./intel-tdx.service";

describe(IntelTdxService.name, () => {
  it("returns unverifiable and makes no call when ITA is not configured", async () => {
    const { service, httpClient } = setup({ apiKey: undefined });

    const verdict = await service.verify({ report: report(), nonce: nonce() });

    expect(verdict).toMatchObject({ kind: "cpu", vendor: "intel-tdx", status: "unverifiable" });
    expect(verdict.detail).toMatch(/not configured/i);
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it("returns valid when ITA attests the quote as up-to-date", async () => {
    const { token, jwks } = await signToken({ attester_tcb_status: "UpToDate", runtime_data: nonce() });
    const { service, httpClient } = setup({ apiKey: "ita-key", token, jwks });

    const verdict = await service.verify({ report: report(), nonce: nonce() });

    expect(verdict.status).toBe("valid");
    const [, , requestConfig] = httpClient.post.mock.calls[0] as [string, unknown, { headers: Record<string, string> }];
    expect(requestConfig.headers["x-api-key"]).toBe("ita-key");
  });

  it("returns invalid when ITA reports a bad TCB status", async () => {
    const { token, jwks } = await signToken({ attester_tcb_status: "OutOfDate", runtime_data: nonce() });
    const { service } = setup({ apiKey: "ita-key", token, jwks });

    const verdict = await service.verify({ report: report(), nonce: nonce() });

    expect(verdict.status).toBe("invalid");
  });

  it("returns unverifiable when the token carries no nonce binding", async () => {
    const { token, jwks } = await signToken({ attester_tcb_status: "UpToDate" }); // no runtime_data/nonce claim
    const { service } = setup({ apiKey: "ita-key", token, jwks });

    const verdict = await service.verify({ report: report(), nonce: nonce() });

    expect(verdict.status).toBe("unverifiable");
    expect(verdict.detail).toMatch(/nonce binding/i);
  });

  it("returns invalid when the token's runtime_data is not bound to the request nonce", async () => {
    const { token, jwks } = await signToken({ attester_tcb_status: "UpToDate", runtime_data: "not-the-nonce" });
    const { service } = setup({ apiKey: "ita-key", token, jwks });

    const verdict = await service.verify({ report: report(), nonce: nonce() });

    expect(verdict).toMatchObject({ status: "invalid", checks: { nonceMatch: false } });
  });

  it("returns unverifiable when the ITA token signature cannot be verified", async () => {
    const { token } = await signToken({ attester_tcb_status: "UpToDate" });
    const { jwks: otherJwks } = await signToken({});
    const { service } = setup({ apiKey: "ita-key", token, jwks: otherJwks });

    const verdict = await service.verify({ report: report(), nonce: nonce() });

    expect(verdict.status).toBe("unverifiable");
  });

  it("propagates ITA transport errors so the orchestrator can mark the report unverifiable", async () => {
    const { service, httpClient } = setup({ apiKey: "ita-key" });
    httpClient.post.mockRejectedValue(new Error("ITA unreachable"));

    await expect(service.verify({ report: report(), nonce: nonce() })).rejects.toThrow("ITA unreachable");
  });

  describe(extractTdxResult.name, () => {
    it("maps known status claims to a pass/fail and is undefined when absent", () => {
      expect(extractTdxResult({ attester_tcb_status: "UpToDate" })).toBe(true);
      expect(extractTdxResult({ attester_tcb_status: "OutOfDate" })).toBe(false);
      expect(extractTdxResult({ unrelated: 1 })).toBeUndefined();
    });
  });

  describe(nonceBinding.name, () => {
    it("matches the base64 nonce or its hex, and is absent when no claim is present", () => {
      const nonceB64 = nonce();
      const nonceHex = Buffer.from(nonceB64, "base64").toString("hex");
      expect(nonceBinding({ runtime_data: nonceB64 }, nonceB64)).toBe("match");
      expect(nonceBinding({ nonce: nonceHex }, nonceB64)).toBe("match");
      expect(nonceBinding({ attester_tcb_status: "UpToDate" }, nonceB64)).toBe("absent");
    });

    it("is a mismatch when a surfaced claim disagrees with the request nonce", () => {
      expect(nonceBinding({ runtime_data: "not-the-nonce" }, nonce())).toBe("mismatch");
    });
  });

  function setup(input: { apiKey?: string; token?: string; jwks?: Jwks }) {
    const httpClient = mock<HttpClient>();
    if (input.token) httpClient.post.mockResolvedValue({ data: { token: input.token } });
    if (input.jwks) httpClient.get.mockResolvedValue({ data: input.jwks });
    const config: ConfidentialComputeConfig = { ...envSchema.parse({}), INTEL_ITA_API_KEY: input.apiKey };
    const service = new IntelTdxService(httpClient, config, mock<LoggerService>());
    return { service, httpClient };
  }
});

function report(): string {
  return Buffer.from("tdx-quote-bytes").toString("base64");
}

function nonce(): string {
  return Buffer.alloc(64, 0x5a).toString("base64");
}

function signToken(claims: Record<string, unknown>): { token: string; jwks: Jwks } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-384" });
  const token = jwt.sign(claims, privateKey.export({ type: "pkcs8", format: "pem" }), { algorithm: "ES384", keyid: "ita-test" });
  const jwk = publicKey.export({ format: "jwk" });
  return { token, jwks: { keys: [{ ...jwk, kid: "ita-test", alg: "ES384" }] } };
}
