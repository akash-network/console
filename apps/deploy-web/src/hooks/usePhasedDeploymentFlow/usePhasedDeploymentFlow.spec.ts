import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import type { ApiProviderList } from "@src/types/provider";
import { usePhasedDeploymentFlow } from "./usePhasedDeploymentFlow";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

const PROVIDER_OWNER = "akash1provider";
const DSEQ = "12345";
const MANIFEST = "manifest-yaml";

describe(usePhasedDeploymentFlow.name, () => {
  it("starts in the creating phase with the first phase active", () => {
    const { result } = setup();

    expect(result.current.state.kind).toBe("creating");
    expect(result.current.phases[0].status).toBe("active");
    expect(result.current.phases[1].status).toBe("pending");
    expect(result.current.phases[2].status).toBe("pending");
  });

  it("advances past creating once createDeployment resolves", async () => {
    const { result, createDeployment } = setup({ providerProxyRequest: vi.fn().mockRejectedValue(new Error("unreachable")) });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));

    expect(createDeployment).toHaveBeenCalledWith({ data: { sdl: "sdl-content", deposit: 5000000 } });
    expect(result.current.phases[0].status).toBe("completed");
    expect(result.current.phases[0].label).toBe("Deployment created");
    expect(result.current.phases[1].status).toBe("active");
  });

  it("transitions to error when createDeployment rejects", async () => {
    const { result } = setup({ createDeployment: vi.fn().mockRejectedValue(new Error("broadcast failed")) });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("error"));
  });

  it("surfaces the API error message on createDeployment failure", async () => {
    const { result } = setup({
      createDeployment: vi.fn().mockRejectedValue(new ApiError(500, { message: "Tx rejected by node" }, "POST /v1/deployments → 500"))
    });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("error"));

    expect(result.current.state).toEqual({ kind: "error", message: "Tx rejected by node" });
  });

  it("stays in matching while no open bid is returned", async () => {
    const { result } = setup({ listBids: vi.fn().mockResolvedValue({ data: [] }) });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(result.current.state.kind).toBe("matching");
  });

  it("stays in matching while the matched provider is unreachable", async () => {
    const { result } = setup({
      providerProxyRequest: vi.fn().mockRejectedValue(new Error("unreachable"))
    });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(result.current.state.kind).toBe("matching");
    expect(result.current.matchedProviderAddress).toBeNull();
  });

  it("advances to preparing and creates a lease once a reachable bid is found", async () => {
    const { result, createLease } = setup();

    await vi.waitFor(() => expect(result.current.matchedProviderAddress).toBe(PROVIDER_OWNER));

    expect(createLease).toHaveBeenCalledWith({
      manifest: MANIFEST,
      leases: [{ dseq: DSEQ, gseq: 1, oseq: 1, provider: PROVIDER_OWNER }]
    });
  });

  it("reaches success and calls onSuccess with the dseq once the lease is created", async () => {
    const onSuccess = vi.fn();
    const { result } = setup({ onSuccess });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("success"));

    expect(onSuccess).toHaveBeenCalledWith(DSEQ);
    expect(result.current.phases.every(phase => phase.status === "completed")).toBe(true);
  });

  it("transitions to error when createLease rejects", async () => {
    const { result } = setup({ createLease: vi.fn().mockRejectedValue(new Error("lease failed")) });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("error"));
  });

  it("restarts the flow from creating when retry is called after an error", async () => {
    const createDeployment = vi
      .fn()
      .mockRejectedValueOnce(new Error("broadcast failed"))
      .mockResolvedValue({ data: { dseq: DSEQ, manifest: MANIFEST } });
    const { result } = setup({ createDeployment });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("error"));

    act(() => result.current.retry());

    await vi.waitFor(() => expect(result.current.state.kind).toBe("success"));
    expect(createDeployment).toHaveBeenCalledTimes(2);
  });

  it("exposes startOver as an alias of retry", () => {
    const { result } = setup();

    expect(result.current.startOver).toBe(result.current.retry);
  });

  it("stays in creating without broadcasting while the trial wallet is not yet ready", async () => {
    const { result, createDeployment } = setup({ isWalletReady: false });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(result.current.state.kind).toBe("creating");
    expect(createDeployment).not.toHaveBeenCalled();
  });

  it("fails the deploy when the trial-start mutation has terminally errored", async () => {
    const { result, createDeployment } = setup({
      isWalletReady: false,
      trialError: new ApiError(400, { message: "Email not verified" }, "POST /v1/wallets/start-trial → 400")
    });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("error"));

    expect(result.current.state).toEqual({ kind: "error", message: "Email not verified" });
    expect(createDeployment).not.toHaveBeenCalled();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setup(input?: {
    sdl?: string;
    deposit?: number;
    onSuccess?: (dseq: string) => void;
    createDeployment?: ReturnType<typeof vi.fn>;
    createLease?: ReturnType<typeof vi.fn>;
    listBids?: ReturnType<typeof vi.fn>;
    providerProxyRequest?: ReturnType<typeof vi.fn>;
    isWalletReady?: boolean;
    trialError?: unknown;
  }) {
    vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => undefined);

    const provider = mock<ApiProviderList>({ owner: PROVIDER_OWNER, hostUri: "https://provider.example" });
    const bid = {
      bid: {
        state: "open",
        id: { provider: PROVIDER_OWNER, dseq: DSEQ, gseq: 1, oseq: 1 }
      }
    };

    const createDeployment = input?.createDeployment ?? vi.fn().mockResolvedValue({ data: { dseq: DSEQ, manifest: MANIFEST } });
    const createLease = input?.createLease ?? vi.fn().mockResolvedValue({ data: {} });
    const listBids = input?.listBids ?? vi.fn().mockResolvedValue({ data: [bid] });

    const api = createProxy({ v1: { createDeployment, createLease, listBids } });

    const providerProxy = mock<ProviderProxyService>();
    if (input?.providerProxyRequest) {
      providerProxy.request.mockImplementation(input.providerProxyRequest as never);
    } else {
      providerProxy.request.mockResolvedValue({ data: {} } as never);
    }

    const publicConsoleApiHttpClient = { get: vi.fn().mockResolvedValue({ data: [provider] }) };

    const view = setupQuery(
      () =>
        usePhasedDeploymentFlow({
          sdl: input?.sdl ?? "sdl-content",
          deposit: input?.deposit ?? 5000000,
          isWalletReady: input?.isWalletReady ?? true,
          trialError: input?.trialError,
          onSuccess: input?.onSuccess ?? vi.fn()
        }),
      {
        services: {
          api: () => api,
          providerProxy: () => providerProxy,
          publicConsoleApiHttpClient: () => publicConsoleApiHttpClient
        } as never
      }
    );

    return { ...view, createDeployment, createLease, listBids, providerProxy };
  }
});
