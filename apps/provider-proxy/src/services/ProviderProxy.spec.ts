import { EventEmitter } from "node:events";
import type { ClientRequest } from "node:http";
import https from "node:https";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CertificateValidator } from "./CertificateValidator/CertificateValidator";
import type { ProviderConnectionTracker } from "./ProviderConnectionTracker/ProviderConnectionTracker";
import { ProviderProxy } from "./ProviderProxy";

describe(ProviderProxy.name, () => {
  it("returns the cached failure without dialing while the provider is in cooldown", async () => {
    const error = Object.assign(new Error("connect EHOSTUNREACH"), { code: "EHOSTUNREACH" });
    const { proxy, connectionTracker } = setup({ shouldSkipDial: true, lastError: error });

    const result = await proxy.connect("https://provider.example.com:8443/lease/1/1/1/status", {
      method: "GET",
      providerAddress: "akash1provider"
    });

    expect(result).toEqual({ ok: false, code: "connectionError", error, shortCircuited: true });
    expect(connectionTracker.getLastError).toHaveBeenCalledWith("akash1provider|https://provider.example.com:8443");
  });

  it("keys the cooldown by provider and dial target together", async () => {
    const { proxy, connectionTracker } = setup({ shouldSkipDial: true });

    await proxy.connect("https://provider.example.com:8443/status", { method: "GET", providerAddress: "akash1provider" });

    expect(connectionTracker.shouldSkipDial).toHaveBeenCalledWith("akash1provider|https://provider.example.com:8443");
  });

  it("does not consult the tracker when there is no provider to key on", async () => {
    const { proxy, connectionTracker } = setup({ shouldSkipDial: true });
    const error = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
    stubDialFailure(error);

    const result = await proxy.connect("https://provider.example.com:8443/status", { method: "GET", providerAddress: "" });

    expect(result).toEqual({ ok: false, code: "connectionError", error });
    expect(connectionTracker.shouldSkipDial).not.toHaveBeenCalled();
    expect(connectionTracker.recordUnreachable).not.toHaveBeenCalled();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function stubDialFailure(error: Error) {
    const request = Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn(), destroy: vi.fn(), reusedSocket: false });
    vi.spyOn(https, "request").mockImplementation(() => {
      setImmediate(() => request.emit("error", error));
      return request as unknown as ClientRequest;
    });
  }

  function setup(input: { shouldSkipDial?: boolean; lastError?: unknown } = {}) {
    const connectionTracker = mock<ProviderConnectionTracker>({
      shouldSkipDial: vi.fn().mockReturnValue(input.shouldSkipDial ?? false),
      getLastError: vi.fn().mockReturnValue(input.lastError)
    });
    const proxy = new ProviderProxy(mock<CertificateValidator>(), undefined, connectionTracker);

    return { proxy, connectionTracker };
  }
});
