import type { HttpClient } from "@akashnetwork/http-sdk";
import type { AxiosHeaders } from "axios";
import { type InternalAxiosRequestConfig } from "axios";
import { mock, mockDeep } from "jest-mock-extended";

import { ANONYMOUS_USER_TOKEN_KEY } from "@src/config/auth.config";
import { ONBOARDING_STEP_KEY } from "@src/services/storage/keys";
import type { AuthUrlService } from "./auth.service";
import { AuthService, withAnonymousUserToken, withUserToken } from "./auth.service";

describe(AuthService.name, () => {
  const mockSignupUrl = "https://auth.example.com/signup";
  const mockLogoutUrl = "https://auth.example.com/logout";

  describe("signup", () => {
    it("calls signup URL without returnTo parameter", async () => {
      const { service, httpClient, location } = setup();

      await service.loginViaOauth();

      expect(httpClient.get).toHaveBeenCalledWith(mockSignupUrl, expect.any(Object));
      expect(location.assign).toHaveBeenCalledWith(mockSignupUrl);
    });

    it("calls signup URL with returnTo parameter", async () => {
      const { service, httpClient, location } = setup();
      const returnTo = "/dashboard";

      await service.loginViaOauth({ returnTo });

      expect(httpClient.get).toHaveBeenCalledWith(mockSignupUrl, expect.any(Object));
      expect(location.assign).toHaveBeenCalledWith(`${mockSignupUrl}?returnTo=${encodeURIComponent(returnTo)}`);
    });
  });

  describe("logout", () => {
    it("clears localStorage items and redirects to logout URL", () => {
      const { service, location, localStorage } = setup();

      // Set up localStorage items
      localStorage.setItem(ANONYMOUS_USER_TOKEN_KEY, "test-token");
      localStorage.setItem(ONBOARDING_STEP_KEY, "2");

      service.logout();

      expect(localStorage.getItem(ANONYMOUS_USER_TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(ONBOARDING_STEP_KEY)).toBeNull();
      expect(location.assign).toHaveBeenCalledWith(mockLogoutUrl);
    });
  });

  describe("withAnonymousUserToken", () => {
    it("adds authorization header when token exists in localStorage", () => {
      const token = "test-anonymous-token";
      localStorage.setItem(ANONYMOUS_USER_TOKEN_KEY, token);

      let config = mockDeep<InternalAxiosRequestConfig>();
      withAnonymousUserToken(config);
      expect(config.headers.set).toHaveBeenCalledWith("authorization", `Bearer ${token}`);

      localStorage.removeItem(ANONYMOUS_USER_TOKEN_KEY);
      config = mockDeep<InternalAxiosRequestConfig>();
      withAnonymousUserToken(config);
      expect(config.headers.set).not.toHaveBeenCalled();
    });
  });

  describe("withUserToken", () => {
    it("adds authorization header when token exists in localStorage", () => {
      const token = "test-user-token";
      localStorage.setItem(ANONYMOUS_USER_TOKEN_KEY, token);

      const config = mockDeep<InternalAxiosRequestConfig>();
      withUserToken(config);

      expect(config.headers.set).toHaveBeenCalledWith("authorization", `Bearer ${token}`);
    });

    it("should set baseURL to proxy when token does not exist", () => {
      localStorage.removeItem(ANONYMOUS_USER_TOKEN_KEY);

      const config = {
        baseURL: "/",
        headers: mock<AxiosHeaders>()
      } as unknown as InternalAxiosRequestConfig;
      withUserToken(config);

      expect(config.baseURL).toBe("/api/proxy");
      expect(config.headers.set).not.toHaveBeenCalled();
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
