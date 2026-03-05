import type { HttpClient } from "@akashnetwork/http-sdk";
import { createHttpClient } from "@akashnetwork/http-sdk";
import { BrokenCircuitError } from "cockatiel";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { type ChainApiHttpClientOptions, createFallbackableHttpClient } from "./createFallbackableHttpClient";

describe(createFallbackableHttpClient.name, () => {
  const originalFetch: typeof fetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("uses fallback http client when request fails after 3 retries and should", async () => {
    const onUnavailableError = vi.fn();
    const options: ChainApiHttpClientOptions = {
      baseURL: "https://api.test.com",
      shouldFallback: () => false,
      onUnavailableError
    };

    const fetch = vi.fn(async () => new Response("error", { status: 500 }));
    const { chainApiHttpClient, fallbackHttpClient } = setup({ options, fetch });

    await Promise.all([chainApiHttpClient.get("/test"), vi.runAllTimersAsync()]);

    expect(fallbackHttpClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "get",
        baseURL: options.baseURL,
        url: "/test"
      })
    );
    expect(onUnavailableError).toHaveBeenCalledTimes(1);
  });

  it("calls onSuccess callback when request succeeds", async () => {
    const onSuccess = vi.fn();
    const options: ChainApiHttpClientOptions = {
      baseURL: "https://api.test.com",
      shouldFallback: () => false,
      onSuccess
    };

    const fetch = vi.fn(async () => new Response("test", { status: 200 }));
    const { chainApiHttpClient } = setup({ options, fetch });

    await Promise.all([chainApiHttpClient.get("/test"), vi.runAllTimersAsync()]);

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("falls back to fallback http client if shouldFallback returns true (circuit breaker is open)", async () => {
    const onUnavailableError = vi.fn();
    const options: ChainApiHttpClientOptions = {
      baseURL: "https://api.test.com",
      shouldFallback: () => true,
      onUnavailableError
    };

    const fetch = vi.fn(async () => new Response("test", { status: 500 }));
    const { chainApiHttpClient, fallbackHttpClient } = setup({ options, fetch });

    await Promise.all([chainApiHttpClient.get("/test"), vi.runAllTimersAsync()]);

    await chainApiHttpClient.get("/test"); // fails fast becaues circuit breaker is open
    expect(onUnavailableError).toHaveBeenCalledWith(expect.any(BrokenCircuitError));
    expect(fallbackHttpClient.request).toHaveBeenCalledTimes(2); // once after failed retries, another one when circuit breaker is open
  });

  function setup(input: { options: ChainApiHttpClientOptions; fetch?: typeof fetch }) {
    vi.useFakeTimers();
    globalThis.fetch = input.fetch || vi.fn().mockResolvedValue(new Response("test"));
    const fallbackHttpClient = mock<HttpClient>({
      request: vi.fn(async () => ({ data: "test", status: 200 }))
    } as unknown as HttpClient);
    const chainApiHttpClient = createFallbackableHttpClient(createHttpClient, fallbackHttpClient, input.options);
    return {
      chainApiHttpClient,
      fallbackHttpClient,
      fetch: globalThis.fetch
    };
  }
});
