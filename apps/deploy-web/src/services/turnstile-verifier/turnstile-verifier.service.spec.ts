import type { HttpClient } from "@akashnetwork/http-sdk";
import { describe, expect, it } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { mock } from "vitest-mock-extended";

import { TurnstileVerifierService } from "./turnstile-verifier.service";

describe(TurnstileVerifierService.name, () => {
  describe("verify", () => {
    it("returns Ok when verification succeeds", async () => {
      const { service, httpClient, config } = setup();
      httpClient.post.mockResolvedValue({ data: { success: true } });

      const result = await service.verify("valid-token");

      expect(result.ok).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        { secret: config.secretKey, response: "valid-token" },
        expect.objectContaining({
          headers: { "Content-Type": "application/json" }
        })
      );
    });

    it("includes remoteIp in payload when provided", async () => {
      const { service, httpClient, config } = setup();
      httpClient.post.mockResolvedValue({ data: { success: true } });

      await service.verify("test-token", { remoteIp: "192.168.1.1" });

      expect(httpClient.post).toHaveBeenCalledWith(
        expect.any(String),
        { secret: config.secretKey, response: "test-token", remoteip: "192.168.1.1" },
        expect.any(Object)
      );
    });

    it("returns Err with error codes when verification fails", async () => {
      const { service, httpClient } = setup();
      httpClient.post.mockResolvedValue({
        data: { success: false, "error-codes": ["invalid-input-response"] }
      });

      const result = await service.verify("invalid-token");

      expect(result.ok).toBe(false);
      expect(result.val).toEqual({
        code: "verification_failed",
        errorCodes: ["invalid-input-response"]
      });
    });

    it("uses bypass secret key when bypass verification token matches", async () => {
      const { service, httpClient, config } = setup();
      httpClient.post.mockResolvedValue({ data: { success: true } });

      await service.verify("test-token", {
        bypassVerificationToken: config.bypassSecretKeyVerificationToken
      });

      expect(httpClient.post).toHaveBeenCalledWith(expect.any(String), { secret: config.turnstileBypassSecretKey, response: "test-token" }, expect.any(Object));
    });

    it("uses regular secret key when bypass verification token does not match", async () => {
      const { service, httpClient, config } = setup();
      httpClient.post.mockResolvedValue({ data: { success: true } });

      await service.verify("test-token", {
        bypassVerificationToken: "wrong-bypass-token"
      });

      expect(httpClient.post).toHaveBeenCalledWith(expect.any(String), { secret: config.secretKey, response: "test-token" }, expect.any(Object));
    });
  });

  function setup() {
    const httpClient: MockProxy<HttpClient> = mock<HttpClient>();
    const config = {
      secretKey: "test-secret-key",
      turnstileBypassSecretKey: "test-bypass-secret-key",
      bypassSecretKeyVerificationToken: "test-bypass-verification-token"
    };
    const service = new TurnstileVerifierService(httpClient, config);

    return { service, httpClient, config };
  }
});
