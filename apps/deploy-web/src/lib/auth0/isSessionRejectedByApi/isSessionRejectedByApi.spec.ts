import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { isSessionRejectedByApi } from "./isSessionRejectedByApi";

describe(isSessionRejectedByApi.name, () => {
  it("returns true when the API answers 401", () => {
    expect(isSessionRejectedByApi(createAxiosError(401))).toBe(true);
  });

  it("returns false when the API answers another error status", () => {
    expect(isSessionRejectedByApi(createAxiosError(403))).toBe(false);
    expect(isSessionRejectedByApi(createAxiosError(500))).toBe(false);
  });

  it("returns false when the request got no answer", () => {
    expect(isSessionRejectedByApi(new AxiosError("Network Error"))).toBe(false);
  });

  it("returns false for a non-axios error carrying a 401 response", () => {
    expect(isSessionRejectedByApi({ response: { status: 401 } })).toBe(false);
    expect(isSessionRejectedByApi(new Error("boom"))).toBe(false);
    expect(isSessionRejectedByApi(undefined)).toBe(false);
  });

  function createAxiosError(status: number) {
    return new AxiosError("Request failed", String(status), undefined, undefined, {
      status,
      statusText: "",
      data: {},
      headers: {},
      config: { headers: new AxiosHeaders() }
    });
  }
});
