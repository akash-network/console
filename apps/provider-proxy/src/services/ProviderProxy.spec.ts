import type { X509Certificate } from "node:crypto";
import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage } from "node:http";
import https from "node:https";
import { TLSSocket } from "node:tls";
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

  it("records unreachable when the provider resets the dial", async () => {
    const { proxy, connectionTracker } = setup();
    const request = stubDial();
    const error = Object.assign(new Error("Client network socket disconnected before secure TLS connection was established"), { code: "ECONNRESET" });

    const pending = proxy.connect("https://provider.example.com:8443/status", { method: "GET", providerAddress: "akash1provider" });
    request.emit("error", error);

    await expect(pending).resolves.toEqual({ ok: false, code: "connectionError", error });
    expect(connectionTracker.recordUnreachable).toHaveBeenCalledWith("akash1provider|https://provider.example.com:8443", error, "ECONNRESET");
  });

  it("flags a dial failure the tracker has already seen for that provider", async () => {
    const { proxy } = setup({ repeatedFailure: true });
    const request = stubDial();
    const error = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });

    const pending = proxy.connect("https://provider.example.com:8443/status", { method: "GET", providerAddress: "akash1provider" });
    request.emit("error", error);

    await expect(pending).resolves.toEqual({ ok: false, code: "connectionError", error, repeatedFailure: true });
  });

  it("leaves a dial killed by the proxy itself unflagged even for a failing provider", async () => {
    const { proxy } = setup({ repeatedFailure: true });
    const request = stubDial();
    const abortController = new AbortController();

    const pending = proxy.connect("https://provider.example.com:8443/status", {
      method: "GET",
      providerAddress: "akash1provider",
      signal: abortController.signal
    });
    abortController.abort();
    const error = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    request.emit("error", error);

    await expect(pending).resolves.toEqual({ ok: false, code: "connectionError", error });
  });

  it("leaves a timeout unflagged for a provider whose earlier failures were connection errors", async () => {
    const { proxy, connectionTracker } = setup({ repeatedFailure: true });
    const request = stubDial();
    const error = Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" });

    const pending = proxy.connect("https://provider.example.com:8443/status", { method: "GET", providerAddress: "akash1provider" });
    request.emit("error", error);

    await expect(pending).resolves.toEqual({ ok: false, code: "connectionError", error });
    expect(connectionTracker.isRepeatedFailure).toHaveBeenCalledWith("akash1provider|https://provider.example.com:8443", "ETIMEDOUT");
  });

  it("records the host as unresponsive when its own per-attempt timeout kills the dial", async () => {
    const { proxy, connectionTracker } = setup();
    const request = stubDial();
    const error = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });

    const pending = proxy.connect("https://provider.example.com:8443/status", {
      method: "GET",
      providerAddress: "akash1provider",
      timeout: 5_000
    });
    request.emit("timeout");
    request.emit("error", error);

    await expect(pending).resolves.toEqual({ ok: false, code: "connectionError", error });
    expect(request.destroy).toHaveBeenCalled();
    expect(connectionTracker.recordUnresponsive).toHaveBeenCalledWith("akash1provider|https://provider.example.com:8443", error);
    expect(connectionTracker.recordUnreachable).not.toHaveBeenCalled();
  });

  it("flags a dial that timed out on a provider already known to be failing", async () => {
    const { proxy, connectionTracker } = setup({ repeatedFailure: true });
    const request = stubDial();
    const error = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });

    const pending = proxy.connect("https://provider.example.com:8443/status", {
      method: "GET",
      providerAddress: "akash1provider",
      timeout: 5_000
    });
    request.emit("timeout");
    request.emit("error", error);

    await expect(pending).resolves.toEqual({ ok: false, code: "connectionError", error, repeatedFailure: true });
    expect(connectionTracker.hasRepeatedFailures).toHaveBeenCalledWith("akash1provider|https://provider.example.com:8443");
  });

  it("records nothing for a dial the client aborted before the timeout could fire", async () => {
    const { proxy, connectionTracker } = setup();
    const request = stubDial();
    const abortController = new AbortController();

    const pending = proxy.connect("https://provider.example.com:8443/status", {
      method: "GET",
      providerAddress: "akash1provider",
      timeout: 5_000,
      signal: abortController.signal
    });
    abortController.abort();
    request.emit("timeout");
    request.emit("error", Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }));

    await expect(pending).resolves.toMatchObject({ ok: false, code: "connectionError" });
    expect(connectionTracker.recordUnresponsive).not.toHaveBeenCalled();
    expect(connectionTracker.recordUnreachable).not.toHaveBeenCalled();
  });

  it("records nothing when the client aborts the dial", async () => {
    const { proxy, connectionTracker } = setup();
    const request = stubDial();
    const abortController = new AbortController();

    const pending = proxy.connect("https://provider.example.com:8443/status", {
      method: "GET",
      providerAddress: "akash1provider",
      signal: abortController.signal
    });
    abortController.abort();
    request.emit("error", Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }));

    await expect(pending).resolves.toMatchObject({ ok: false, code: "connectionError" });
    expect(request.destroy).toHaveBeenCalled();
    expect(connectionTracker.recordUnreachable).not.toHaveBeenCalled();
  });

  it("records nothing when the connection drops after the provider answered", async () => {
    const { proxy, connectionTracker } = setup();
    const { response } = stubDialWithTlsResponse();

    const result = await proxy.connect("https://provider.example.com:8443/status", { method: "GET", providerAddress: "akash1provider" });
    response.emit("error", Object.assign(new Error("aborted"), { code: "ECONNRESET" }));

    expect(result).toMatchObject({ ok: true });
    expect(connectionTracker.recordReachable).toHaveBeenCalledWith("akash1provider|https://provider.example.com:8443");
    expect(connectionTracker.recordUnreachable).not.toHaveBeenCalled();
  });

  it("records nothing for a dial killed by another request's certificate teardown", async () => {
    const { proxy, connectionTracker, certificateValidator } = setup();
    certificateValidator.validate.mockResolvedValue({ ok: false, code: "expired" });
    const { collateralRequest } = stubCertRejectedDialThenPendingDial();

    const rejected = proxy.connect("https://provider.example.com:8443/status", { method: "GET", providerAddress: "akash1provider" });
    const collateral = proxy.connect("https://provider.example.com:8443/status", { method: "GET", providerAddress: "akash1provider" });
    await expect(rejected).resolves.toEqual({ ok: false, code: "invalidCertificate", reason: "expired" });
    collateralRequest.emit("error", Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }));

    await expect(collateral).resolves.toMatchObject({ ok: false, code: "connectionError" });
    expect(connectionTracker.recordUnreachable).not.toHaveBeenCalled();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function stubCertRejectedDialThenPendingDial() {
    const rejectedRequest = Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn(), destroy: vi.fn(), reusedSocket: false });
    const collateralRequest = Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn(), destroy: vi.fn(), reusedSocket: false });
    const socket = Object.assign(Object.create(TLSSocket.prototype) as TLSSocket, {
      authorized: false,
      getPeerX509Certificate: vi.fn().mockReturnValue(mock<X509Certificate>())
    });
    const response = Object.assign(new EventEmitter(), { socket, destroy: vi.fn(), pause: vi.fn(), resume: vi.fn() });
    const requests = [rejectedRequest, collateralRequest];
    vi.spyOn(https, "request").mockImplementation((_url, _options, callback) => {
      const request = requests.shift();
      if (request === rejectedRequest) setImmediate(() => (callback as ((res: IncomingMessage) => void) | undefined)?.(response as unknown as IncomingMessage));
      return request as unknown as ClientRequest;
    });
    return { collateralRequest };
  }

  function stubDial() {
    const request = Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn(), destroy: vi.fn(), reusedSocket: false });
    vi.spyOn(https, "request").mockImplementation(() => request as unknown as ClientRequest);
    return request;
  }

  function stubDialWithTlsResponse() {
    const request = Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn(), destroy: vi.fn(), reusedSocket: false });
    const socket = Object.assign(Object.create(TLSSocket.prototype) as TLSSocket, { authorized: true });
    const response = Object.assign(new EventEmitter(), { socket, destroy: vi.fn(), pause: vi.fn(), resume: vi.fn() });
    vi.spyOn(https, "request").mockImplementation((_url, _options, callback) => {
      setImmediate(() => (callback as ((res: IncomingMessage) => void) | undefined)?.(response as unknown as IncomingMessage));
      return request as unknown as ClientRequest;
    });
    return { request, response };
  }

  function stubDialFailure(error: Error) {
    const request = Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn(), destroy: vi.fn(), reusedSocket: false });
    vi.spyOn(https, "request").mockImplementation(() => {
      setImmediate(() => request.emit("error", error));
      return request as unknown as ClientRequest;
    });
  }

  function setup(input: { shouldSkipDial?: boolean; lastError?: unknown; repeatedFailure?: boolean } = {}) {
    const connectionTracker = mock<ProviderConnectionTracker>({
      shouldSkipDial: vi.fn().mockReturnValue(input.shouldSkipDial ?? false),
      getLastError: vi.fn().mockReturnValue(input.lastError),
      isRepeatedFailure: vi.fn((_key: string, errno: string | undefined) => (input.repeatedFailure ?? false) && errno === "ECONNRESET"),
      hasRepeatedFailures: vi.fn().mockReturnValue(input.repeatedFailure ?? false)
    });
    const certificateValidator = mock<CertificateValidator>();
    const proxy = new ProviderProxy(certificateValidator, undefined, connectionTracker);

    return { proxy, connectionTracker, certificateValidator };
  }
});
