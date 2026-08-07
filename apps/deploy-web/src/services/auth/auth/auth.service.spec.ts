import type { HttpClient } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthUrlService } from "./auth.service";
import { AuthService } from "./auth.service";

describe(AuthService.name, () => {
  const mockSignupUrl = "https://auth.example.com/signup";
  const mockLogoutUrl = "https://auth.example.com/logout";

  describe("loginViaOauth", () => {
    it("calls signup URL without returnTo parameter", async () => {
      const { service, location } = setup();

      await service.loginViaOauth();

      expect(location.assign).toHaveBeenCalledWith(mockSignupUrl);
    });

    it("calls signup URL with returnTo parameter", async () => {
      const { service, location } = setup();
      const returnTo = "/dashboard";

      await service.loginViaOauth({ returnTo });

      expect(location.assign).toHaveBeenCalledWith(`${mockSignupUrl}?returnTo=${encodeURIComponent(returnTo)}`);
    });
  });

  describe("startEmailCode", () => {
    it("posts to /api/auth/email-code-start with the captcha token", async () => {
      const { service, httpClient } = setup();

      await service.startEmailCode({ email: "user@example.com", captchaToken: "tok" });

      expect(httpClient.post).toHaveBeenCalledWith("/api/auth/email-code-start", {
        email: "user@example.com",
        captchaToken: "tok"
      });
    });
  });

  describe("verifyEmailCode", () => {
    it("posts to /api/auth/email-code-verify with the code and captcha token", async () => {
      const { service, httpClient } = setup();

      await service.verifyEmailCode({ email: "user@example.com", code: "123456", captchaToken: "tok" });

      expect(httpClient.post).toHaveBeenCalledWith("/api/auth/email-code-verify", {
        email: "user@example.com",
        code: "123456",
        captchaToken: "tok"
      });
    });
  });

  describe("logout", () => {
    it("redirects to the logout URL", () => {
      const { service, location } = setup();

      service.logout();

      expect(location.assign).toHaveBeenCalledWith(mockLogoutUrl);
    });
  });

  function setup() {
    const httpClient = mock<HttpClient>({
      get: vi.fn().mockResolvedValue({ data: {} })
    } as unknown as HttpClient);
    const urlService = mock<AuthUrlService>({
      signup: vi.fn().mockReturnValue(mockSignupUrl),
      logout: vi.fn().mockReturnValue(mockLogoutUrl)
    });
    const location = mock<Location>();

    const service = new AuthService(urlService, httpClient, location);

    return {
      service,
      httpClient,
      urlService,
      location
    };
  }
});
