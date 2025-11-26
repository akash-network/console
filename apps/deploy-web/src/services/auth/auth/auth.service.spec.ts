import type { HttpClient } from "@akashnetwork/http-sdk";
import { mock } from "jest-mock-extended";

import { ONBOARDING_STEP_KEY } from "@src/services/storage/keys";
import type { AuthUrlService } from "./auth.service";
import { AuthService } from "./auth.service";

describe(AuthService.name, () => {
  const mockSignupUrl = "https://auth.example.com/signup";
  const mockLogoutUrl = "https://auth.example.com/logout";

  describe("signup", () => {
    it("calls signup URL without returnTo parameter", async () => {
      const { service, httpClient, location } = setup();

      await service.signup();

      expect(httpClient.get).toHaveBeenCalledWith(mockSignupUrl, expect.any(Object));
      expect(location.assign).toHaveBeenCalledWith(mockSignupUrl);
    });

    it("calls signup URL with returnTo parameter", async () => {
      const { service, httpClient, location } = setup();
      const returnTo = "/dashboard";

      await service.signup({ returnTo });

      expect(httpClient.get).toHaveBeenCalledWith(mockSignupUrl, expect.any(Object));
      expect(location.assign).toHaveBeenCalledWith(`${mockSignupUrl}?returnTo=${encodeURIComponent(returnTo)}`);
    });
  });

  describe("logout", () => {
    it("clears localStorage items and redirects to logout URL", () => {
      const { service, location, localStorage } = setup();

      // Set up localStorage items
      localStorage.setItem(ONBOARDING_STEP_KEY, "2");

      service.logout();

      expect(localStorage.getItem(ONBOARDING_STEP_KEY)).toBeNull();
      expect(location.assign).toHaveBeenCalledWith(mockLogoutUrl);
    });
  });

  function setup() {
    const httpClient = mock<HttpClient>({
      get: jest.fn().mockResolvedValue({ data: {} })
    } as unknown as HttpClient);
    const urlService = mock<AuthUrlService>({
      signup: jest.fn().mockReturnValue(mockSignupUrl),
      logout: jest.fn().mockReturnValue(mockLogoutUrl)
    });
    const location = mock<Location>();

    const service = new AuthService(urlService, httpClient, location);

    return {
      service,
      httpClient,
      urlService,
      location,
      localStorage
    };
  }
});
