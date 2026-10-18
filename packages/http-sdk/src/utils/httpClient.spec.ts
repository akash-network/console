import { afterEach, describe, expect, it, vi } from "vitest";

import { createHttpClient } from "./httpClient";

describe(createHttpClient.name, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("keeps the AbortError name of a request the browser aborted", async () => {
    const { request } = setup({ fetchFailure: new DOMException("The operation was aborted.", "AbortError") });

    await expect(request()).rejects.toMatchObject({ name: "AbortError", isAxiosError: true });
  });

  it("reports a request Safari could not send as a network error", async () => {
    const { request } = setup({ fetchFailure: new TypeError("Load failed") });

    await expect(request()).rejects.toMatchObject({ code: "ERR_NETWORK", isAxiosError: true });
  });

  function setup(input: { fetchFailure: Error }) {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(input.fetchFailure));
    const httpClient = createHttpClient({ baseURL: "https://chain.example" });

    const request = async () => {
      const response = httpClient.get("/akash/market/v1beta5/leases/list");
      const settled = response.catch(() => undefined);
      await vi.runAllTimersAsync();
      await settled;
      return response;
    };

    return { request };
  }
});
