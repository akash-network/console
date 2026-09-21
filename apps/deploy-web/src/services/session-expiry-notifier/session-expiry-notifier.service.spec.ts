import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";

import { createSessionExpiryFetch, createSessionExpiryResponseInterceptor, SessionExpiryNotifier } from "./session-expiry-notifier.service";

describe(SessionExpiryNotifier.name, () => {
  it("notifies every subscribed listener", () => {
    const notifier = new SessionExpiryNotifier();
    const first = vi.fn();
    const second = vi.fn();
    notifier.subscribe(first);
    notifier.subscribe(second);

    notifier.notify();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops notifying a listener after unsubscribe", () => {
    const notifier = new SessionExpiryNotifier();
    const listener = vi.fn();
    const unsubscribe = notifier.subscribe(listener);

    unsubscribe();
    notifier.notify();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe(createSessionExpiryResponseInterceptor.name, () => {
  it("notifies and rethrows on a 401 from the session proxy", async () => {
    const { interceptor, notifier } = setup();
    const error = createAxiosError({ status: 401, baseURL: "/api/proxy" });

    await expect(interceptor(error)).rejects.toBe(error);
    expect(notifier.notify).toHaveBeenCalledTimes(1);
  });

  it("rethrows without notifying on a non-401 from the session proxy", async () => {
    const { interceptor, notifier } = setup();
    const error = createAxiosError({ status: 500, baseURL: "/api/proxy" });

    await expect(interceptor(error)).rejects.toBe(error);
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("rethrows without notifying on a 401 from another origin", async () => {
    const { interceptor, notifier } = setup();
    const error = createAxiosError({ status: 401, baseURL: "https://provider-proxy.example.com" });

    await expect(interceptor(error)).rejects.toBe(error);
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("rethrows without notifying on a non-axios error", async () => {
    const { interceptor, notifier } = setup();
    const error = new Error("network down");

    await expect(interceptor(error)).rejects.toBe(error);
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  function setup() {
    const notifier = new SessionExpiryNotifier();
    vi.spyOn(notifier, "notify");
    const interceptor = createSessionExpiryResponseInterceptor(notifier);
    return { interceptor, notifier };
  }
});

describe(createSessionExpiryFetch.name, () => {
  it("forwards the request to the wrapped fetch and hands back its response", async () => {
    const response = new Response(null, { status: 200 });
    const { fetchWithSessionExpiry, fetchImpl } = setup({ response });
    const init = { method: "POST", body: "{}" };

    await expect(fetchWithSessionExpiry("/api/proxy/v1/deployments", init)).resolves.toBe(response);
    expect(fetchImpl).toHaveBeenCalledWith("/api/proxy/v1/deployments", init);
  });

  it("notifies on a 401 and still hands back the response", async () => {
    const response = new Response(null, { status: 401 });
    const { fetchWithSessionExpiry, notifier } = setup({ response });

    await expect(fetchWithSessionExpiry("/api/proxy/v1/deployments")).resolves.toBe(response);
    expect(notifier.notify).toHaveBeenCalledTimes(1);
  });

  it("does not notify on a successful response", async () => {
    const { fetchWithSessionExpiry, notifier } = setup({ response: new Response(null, { status: 200 }) });

    await fetchWithSessionExpiry("/api/proxy/v1/deployments");

    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("does not notify on a non-401 error response", async () => {
    const { fetchWithSessionExpiry, notifier } = setup({ response: new Response(null, { status: 500 }) });

    await fetchWithSessionExpiry("/api/proxy/v1/deployments");

    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("rejects without notifying when the wrapped fetch fails", async () => {
    const failure = new TypeError("network down");
    const { fetchWithSessionExpiry, notifier } = setup({ failure });

    await expect(fetchWithSessionExpiry("/api/proxy/v1/deployments")).rejects.toBe(failure);
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  function setup(input: { response?: Response; failure?: Error }) {
    const notifier = new SessionExpiryNotifier();
    vi.spyOn(notifier, "notify");
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      if (input.failure) throw input.failure;
      return input.response ?? new Response(null, { status: 200 });
    });
    const fetchWithSessionExpiry = createSessionExpiryFetch(notifier, fetchImpl);
    return { fetchWithSessionExpiry, fetchImpl, notifier };
  }
});

function createAxiosError(input: { status: number; baseURL: string }) {
  const config = { baseURL: input.baseURL, url: "v1/wallets" } as InternalAxiosRequestConfig;
  const response = { status: input.status, config } as AxiosResponse;
  return new AxiosError("Request failed", String(input.status), config, undefined, response);
}
