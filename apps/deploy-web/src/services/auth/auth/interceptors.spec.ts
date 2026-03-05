import type { AxiosHeaders, InternalAxiosRequestConfig } from "axios";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { withUserToken } from "./interceptors";

describe("Auth Axios Interceptors", () => {
  describe("withUserToken", () => {
    it("should set baseURL to proxy", () => {
      const config = {
        baseURL: "/",
        headers: mock<AxiosHeaders>()
      } as unknown as InternalAxiosRequestConfig;
      withUserToken(config);

      expect(config.baseURL).toBe("/api/proxy");
    });
  });
});
