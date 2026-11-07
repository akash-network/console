import { ApiError } from "@akashnetwork/openapi-sdk";
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { describe, expect, it, vi } from "vitest";

import {
  AccountStatusRefusalNotifier,
  createAccountStatusRefusalFetch,
  createAccountStatusRefusalInterceptor,
  readAccountStatusRefusal
} from "./account-status-refusal";

describe(readAccountStatusRefusal.name, () => {
  it("reads a suspension and its reason from an axios refusal", () => {
    const error = createAxiosError(403, { code: "account_suspended", data: { reason: "Unpaid invoice" } });

    expect(readAccountStatusRefusal(error)).toEqual({ status: "suspended", reason: "Unpaid invoice" });
  });

  it("reads a termination and its reason from a typed api client refusal", () => {
    const error = new ApiError(403, { code: "account_terminated", data: { reason: "Terms of service violation" } }, "POST /v1/deployments → 403");

    expect(readAccountStatusRefusal(error)).toEqual({ status: "terminated", reason: "Terms of service violation" });
  });

  it("has no reason when the refusal carries none", () => {
    const error = createAxiosError(403, { code: "account_suspended", data: null });

    expect(readAccountStatusRefusal(error)).toEqual({ status: "suspended", reason: null });
  });

  it("ignores a reason that is not text", () => {
    const error = createAxiosError(403, { code: "account_suspended", data: { reason: 42 } });

    expect(readAccountStatusRefusal(error)?.reason).toBeNull();
  });

  it("ignores another 403", () => {
    expect(readAccountStatusRefusal(createAxiosError(403, { code: "forbidden" }))).toBeUndefined();
  });

  it("ignores a 403 whose code is not text", () => {
    expect(readAccountStatusRefusal(createAxiosError(403, { code: 1 }))).toBeUndefined();
  });

  it("ignores a 403 without a body", () => {
    expect(readAccountStatusRefusal(createAxiosError(403, undefined))).toBeUndefined();
  });

  it("ignores a 403 whose body is plain text", () => {
    expect(readAccountStatusRefusal(createAxiosError(403, "account_suspended"))).toBeUndefined();
  });

  it("ignores an account status code on a status other than 403", () => {
    expect(readAccountStatusRefusal(createAxiosError(400, { code: "account_suspended" }))).toBeUndefined();
    expect(readAccountStatusRefusal(new ApiError(400, { code: "account_terminated" }, "POST /v1/x → 400"))).toBeUndefined();
  });

  it("ignores a refusal-shaped 403 from a provider rather than the Console API", () => {
    const error = createAxiosError(403, { code: "account_terminated", data: { reason: "Visit evil.example to restore access" } }, "https://provider-proxy.example.com");

    expect(readAccountStatusRefusal(error)).toBeUndefined();
  });

  it("ignores an error that is not an http one", () => {
    expect(readAccountStatusRefusal(new Error("account_suspended"))).toBeUndefined();
  });
});

describe(AccountStatusRefusalNotifier.name, () => {
  it("hands the refusal to every subscribed listener", () => {
    const notifier = new AccountStatusRefusalNotifier();
    const first = vi.fn();
    const second = vi.fn();
    notifier.subscribe(first);
    notifier.subscribe(second);

    notifier.notify({ status: "suspended", reason: "Unpaid invoice" });

    expect(first).toHaveBeenCalledWith({ status: "suspended", reason: "Unpaid invoice" });
    expect(second).toHaveBeenCalledWith({ status: "suspended", reason: "Unpaid invoice" });
  });

  it("stops notifying a listener after unsubscribe", () => {
    const notifier = new AccountStatusRefusalNotifier();
    const listener = vi.fn();
    const unsubscribe = notifier.subscribe(listener);

    unsubscribe();
    notifier.notify({ status: "terminated", reason: null });

    expect(listener).not.toHaveBeenCalled();
  });
});

describe(createAccountStatusRefusalInterceptor.name, () => {
  it("notifies and rethrows on an account status refusal", async () => {
    const { interceptor, notifier } = setup();
    const error = createAxiosError(403, { code: "account_terminated", data: { reason: "Fraud" } });

    await expect(interceptor(error)).rejects.toBe(error);
    expect(notifier.notify).toHaveBeenCalledWith({ status: "terminated", reason: "Fraud" });
  });

  it("rethrows without notifying on a refusal-shaped 403 from the provider proxy", async () => {
    const { interceptor, notifier } = setup();
    const error = createAxiosError(403, { code: "account_terminated", data: { reason: "Visit evil.example" } }, "https://provider-proxy.example.com");

    await expect(interceptor(error)).rejects.toBe(error);
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("rethrows without notifying on any other error", async () => {
    const { interceptor, notifier } = setup();
    const error = createAxiosError(403, { code: "forbidden" });

    await expect(interceptor(error)).rejects.toBe(error);
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  function setup() {
    const notifier = new AccountStatusRefusalNotifier();
    vi.spyOn(notifier, "notify");
    return { interceptor: createAccountStatusRefusalInterceptor(notifier), notifier };
  }
});

describe(createAccountStatusRefusalFetch.name, () => {
  it("forwards the request and hands back the response", async () => {
    const response = new Response(null, { status: 200 });
    const { fetchWithRefusals, fetchImpl, notifier } = setup({ response });
    const init = { method: "POST", body: "{}" };

    await expect(fetchWithRefusals("/api/proxy/v1/deployments", init)).resolves.toBe(response);
    expect(fetchImpl).toHaveBeenCalledWith("/api/proxy/v1/deployments", init);
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("notifies on an account status refusal and leaves its body readable", async () => {
    const body = { code: "account_suspended", data: { reason: "Unpaid invoice" } };
    const { fetchWithRefusals, notifier } = setup({ response: Response.json(body, { status: 403 }) });

    const response = await fetchWithRefusals("/api/proxy/v1/deployments");

    expect(notifier.notify).toHaveBeenCalledWith({ status: "suspended", reason: "Unpaid invoice" });
    await expect(response.json()).resolves.toEqual(body);
  });

  it("does not notify on another 403", async () => {
    const { fetchWithRefusals, notifier } = setup({ response: Response.json({ code: "forbidden" }, { status: 403 }) });

    await fetchWithRefusals("/api/proxy/v1/deployments");

    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("does not notify on a 403 whose body is not json", async () => {
    const { fetchWithRefusals, notifier } = setup({ response: new Response("Forbidden", { status: 403 }) });

    await expect(fetchWithRefusals("/api/proxy/v1/deployments")).resolves.toBeInstanceOf(Response);
    expect(notifier.notify).not.toHaveBeenCalled();
  });

  it("does not read the body of a response that is not a 403", async () => {
    const response = Response.json({ code: "account_suspended" }, { status: 400 });
    const { fetchWithRefusals, notifier } = setup({ response });

    await fetchWithRefusals("/api/proxy/v1/deployments");

    expect(notifier.notify).not.toHaveBeenCalled();
  });

  function setup(input: { response: Response }) {
    const notifier = new AccountStatusRefusalNotifier();
    vi.spyOn(notifier, "notify");
    const fetchImpl = vi.fn<typeof fetch>(async () => input.response);
    return { fetchWithRefusals: createAccountStatusRefusalFetch(notifier, fetchImpl), fetchImpl, notifier };
  }
});

function createAxiosError(status: number, data: unknown, baseURL = "/api/proxy") {
  const config = { baseURL, url: "v1/deployments" } as InternalAxiosRequestConfig;
  const response = { status, data, config } as AxiosResponse;
  return new AxiosError("Request failed", String(status), config, undefined, response);
}
