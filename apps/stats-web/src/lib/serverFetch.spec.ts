import { describe, expect, it, vi } from "vitest";

const headerValues = vi.hoisted(() => {
  return { values: {} as Record<string, string | null> };
});

vi.mock("next/headers", () => ({
  headers: () => ({
    get: (name: string) => headerValues.values[name] ?? null
  })
}));

vi.mock("@/services/di", () => ({
  errorHandler: {
    getTraceData: () => ({})
  }
}));

import { serverFetch } from "./serverFetch";

describe("serverFetch", () => {
  it("forwards request to fetch with no-store cache", async () => {
    const { response, mockFetch } = await setup({ url: "https://api.example.com/v1/test" });

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/v1/test", expect.objectContaining({ cache: "no-store" }));
  });

  it("aborts after 10 seconds when API does not respond", async () => {
    const { fetchPromise, advanceTimers } = setup({ url: "https://api.example.com/v1/slow", hangForever: true });

    advanceTimers(10_000);

    await expect(fetchPromise).rejects.toThrow("The operation was aborted.");
  });

  it("clears timeout after successful fetch", async () => {
    const clearTimeoutSpy = vi.fn(clearTimeout);
    globalThis.clearTimeout = clearTimeoutSpy;

    await setup({ url: "https://api.example.com/v1/test" });

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("uses caller-provided signal instead of internal timeout", async () => {
    const callerController = new AbortController();
    const { mockFetch } = await setup({ url: "https://api.example.com/v1/test", signal: callerController.signal });

    expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/v1/test", expect.objectContaining({ signal: callerController.signal }));
  });

  it("merges IP forwarding headers into the request", async () => {
    const { mockFetch } = await setup({
      url: "https://api.example.com/v1/test",
      headers: { "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" }
    });

    const passedHeaders = mockFetch.mock.calls[0][1].headers as Headers;
    expect(passedHeaders.get("cf-connecting-ip")).toBe("1.2.3.4");
    expect(passedHeaders.get("x-forwarded-for")).toBe("5.6.7.8");
  });

  function setup(input: { url: string; signal?: AbortSignal; headers?: Record<string, string>; hangForever?: true }) {
    const originalFetch = globalThis.fetch;
    headerValues.values = input.headers ?? {};

    if (input.hangForever) {
      vi.useFakeTimers();

      const mockFetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      });
      globalThis.fetch = mockFetch;

      const fetchPromise = serverFetch(input.url).finally(() => {
        globalThis.fetch = originalFetch;
        headerValues.values = {};
        vi.useRealTimers();
      });

      return { fetchPromise, mockFetch, advanceTimers: (ms: number) => vi.advanceTimersByTime(ms) };
    }

    const mockFetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = mockFetch;

    return serverFetch(input.url, input.signal ? { signal: input.signal } : undefined).then(response => {
      globalThis.fetch = originalFetch;
      headerValues.values = {};
      return { response, mockFetch };
    });
  }
});
