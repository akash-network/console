import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";

import { createSessionExpiryResponseInterceptor, SessionExpiryNotifier } from "./session-expiry-notifier.service";

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

function createAxiosError(input: { status: number; baseURL: string }) {
  const config = { baseURL: input.baseURL, url: "v1/wallets" } as InternalAxiosRequestConfig;
  const response = { status: input.status, config } as AxiosResponse;
  return new AxiosError("Request failed", String(input.status), config, undefined, response);
}
