import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UseProviderCredentialsResult } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { LEASE_LOGS_SCOPE } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import type { ProviderLookupService } from "@src/services/provider-lookup/provider-lookup.service";
import type { ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import type { AssistantClientToolRequest } from "@src/types/assistant";
import type { ApiProviderList } from "@src/types/provider";
import type { DEPENDENCIES } from "./useAssistantClientTools";
import { useAssistantClientTools } from "./useAssistantClientTools";

import { renderHook } from "@testing-library/react";

type Container = ReturnType<typeof DEPENDENCIES.useServices>;

describe(useAssistantClientTools.name, () => {
  it("reads the logs of the deployment's live lease through the provider connection", async () => {
    const { runClientTool, providerProxy, listLeases, ensureToken } = setup({ readLogs: "[web]: started\n" });

    const result = await runClientTool(request({ arguments: { dseq: "42", service: "web", tailLines: 50 } }));

    expect(result).toEqual({ toolCallId: "t-1", ok: true, content: "[web]: started\n" });
    expect(listLeases).toHaveBeenCalledWith({ dseq: "42" });
    expect(providerProxy.readLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        providerBaseUrl: "https://provider.test:8443",
        providerAddress: "akash1provider",
        dseq: "42",
        gseq: 1,
        oseq: 2,
        type: "logs",
        tail: 50,
        services: ["web"]
      })
    );

    await providerProxy.readLogs.mock.calls[0][0].ensureToken();
    expect(ensureToken).toHaveBeenCalledWith({ access: { provider: "akash1provider", dseqs: ["42"], scope: LEASE_LOGS_SCOPE } });
  });

  it("reads events for every service with the default tail", async () => {
    const { runClientTool, providerProxy } = setup({ readLogs: "event" });

    await runClientTool(request({ name: "read_events" }));

    expect(providerProxy.readLogs).toHaveBeenCalledWith(expect.objectContaining({ type: "events", tail: 200, services: undefined }));
  });

  it("joins the output of every live lease and skips closed ones", async () => {
    const { runClientTool, providerProxy } = setup({
      leases: [lease({ gseq: 1, state: "active" }), lease({ gseq: 2, state: "closed" }), lease({ gseq: 3, state: "reclaiming" })],
      readLogs: "line\n"
    });

    const result = await runClientTool(request());

    expect(result.content).toBe("line\nline\n");
    expect(providerProxy.readLogs.mock.calls.map(([input]) => input.gseq)).toEqual([1, 3]);
  });

  it("keeps the newest output when it is longer than the api accepts", async () => {
    const { runClientTool } = setup({ readLogs: "old lines\nnew line" });

    const result = await runClientTool(request({ maxLength: 8 }));

    expect(result.content).toBe("new line");
  });

  it("says nothing was returned when the provider sent nothing", async () => {
    const { runClientTool } = setup({ readLogs: "" });

    expect(await runClientTool(request())).toEqual({ toolCallId: "t-1", ok: true, content: "Nothing was returned." });
  });

  it("explains that a deployment without a live lease has nothing to read", async () => {
    const { runClientTool, providerProxy } = setup({ leases: [lease({ state: "closed" })] });

    expect(await runClientTool(request())).toEqual({
      toolCallId: "t-1",
      ok: false,
      content: "The deployment has no active lease, so there is nothing to read."
    });
    expect(providerProxy.readLogs).not.toHaveBeenCalled();
  });

  it("explains that the provider could not be found", async () => {
    const { runClientTool } = setup({ provider: null });

    expect(await runClientTool(request())).toEqual(expect.objectContaining({ ok: false, content: "Couldn't find the provider running this deployment." }));
  });

  it("explains that the user has no access when no provider token can be made", async () => {
    const { runClientTool, providerProxy, ensureToken } = setup({ readLogs: "" });
    ensureToken.mockRejectedValue(new Error("view only"));
    providerProxy.readLogs.mockImplementation(async input => {
      await input.ensureToken().catch(() => undefined);
      return "";
    });

    expect(await runClientTool(request())).toEqual(
      expect.objectContaining({ ok: false, content: "Couldn't get access to this deployment's logs and events." })
    );
  });

  it("explains that the provider is unreachable when the read fails, within the length the api accepts", async () => {
    const { runClientTool, providerProxy } = setup({});
    providerProxy.readLogs.mockRejectedValue(new Error("socket closed"));

    expect(await runClientTool(request())).toEqual({ toolCallId: "t-1", ok: false, content: "Couldn't reach the provider running this deployment." });
    expect((await runClientTool(request({ maxLength: 10 }))).content).toBe("Couldn't r");
  });

  function request(input: Partial<AssistantClientToolRequest> = {}): AssistantClientToolRequest {
    return { type: "client_tool_request", toolCallId: "t-1", name: "read_logs", arguments: { dseq: "42" }, maxLength: 16000, ...input };
  }

  function lease(input: { gseq?: number; state?: string } = {}) {
    return { id: { owner: "akash1owner", dseq: "42", gseq: input.gseq ?? 1, oseq: 2, provider: "akash1provider", bseq: 1 }, state: input.state ?? "active" };
  }

  function setup(input: { leases?: ReturnType<typeof lease>[]; provider?: Pick<ApiProviderList, "owner" | "hostUri"> | null; readLogs?: string }) {
    const listLeases = vi.fn(async () => ({ data: input.leases ?? [lease()] }));
    const api = createProxy({ v1: { listLeases } });
    const providerLookup = mock<ProviderLookupService>();
    providerLookup.findByAddress.mockResolvedValue(
      (input.provider === undefined ? { owner: "akash1provider", hostUri: "https://provider.test:8443" } : input.provider) as ApiProviderList | null
    );
    const providerProxy = mock<ProviderProxyService>();
    providerProxy.readLogs.mockResolvedValue(input.readLogs ?? "");
    const ensureToken = vi.fn<UseProviderCredentialsResult["ensureToken"]>(async () => "jwt");
    const container = Object.assign(mock<Container>(), { api: api as unknown as Container["api"], providerLookup, providerProxy });
    const dependencies: typeof DEPENDENCIES = {
      useServices: () => container,
      useProviderCredentials: () => mock<UseProviderCredentialsResult>({ ensureToken })
    };

    const { result } = renderHook(() => useAssistantClientTools(dependencies));

    return { runClientTool: result.current, providerProxy, providerLookup, listLeases, ensureToken };
  }
});
