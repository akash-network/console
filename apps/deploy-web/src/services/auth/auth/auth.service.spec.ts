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

  describe("logout", () => {
    it("redirects to logout URL", () => {
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
