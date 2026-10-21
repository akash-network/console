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

  it("leaves the User-Agent header to the browser", async () => {
    const { request, sentHeaders } = setup({ runsInBrowser: true });

    await request();

    expect(sentHeaders().has("user-agent")).toBe(false);
  });

  it("sends the axios User-Agent outside the browser", async () => {
    const { request, sentHeaders } = setup({ runsInBrowser: false });

    await request();

    expect(sentHeaders().get("user-agent")).toMatch(/^axios\//);
  });

  it("sends the User-Agent the caller sets", async () => {
    const { request, sentHeaders } = setup({ runsInBrowser: true, headers: { "User-Agent": "AkashConsole/1.0" } });

    await request();

    expect(sentHeaders().get("user-agent")).toBe("AkashConsole/1.0");
  });

  function setup(input: { fetchFailure?: Error; runsInBrowser?: boolean; headers?: Record<string, string> }) {
    vi.useFakeTimers();
    if (input.runsInBrowser) vi.stubGlobal("window", {});
    const fetch = input.fetchFailure ? vi.fn().mockRejectedValue(input.fetchFailure) : vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetch);
    const httpClient = createHttpClient({ baseURL: "https://chain.example", headers: input.headers });

    const request = async () => {
      const response = httpClient.get("/akash/market/v1beta5/leases/list");
      const settled = response.catch(() => undefined);
      await vi.runAllTimersAsync();
      await settled;
      return response;
    };
    const sentHeaders = (): Headers => fetch.mock.calls[0][0].headers;

    return { request, sentHeaders };
  }
});
