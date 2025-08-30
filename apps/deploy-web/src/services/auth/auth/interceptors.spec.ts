import type { AxiosHeaders, InternalAxiosRequestConfig } from "axios";
import { mock, mockDeep } from "jest-mock-extended";

import { ANONYMOUS_USER_TOKEN_KEY } from "@src/config/auth.config";
import { withAnonymousUserToken, withUserToken } from "./interceptors";

describe("Auth Axios Interceptors", () => {
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
});
