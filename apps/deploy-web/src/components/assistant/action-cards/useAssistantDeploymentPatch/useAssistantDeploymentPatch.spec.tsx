import type { ReactNode } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SdlSecretsSealContext } from "@src/utils/sdl/sealSdlSecrets";
import type { DEPENDENCIES } from "./useAssistantDeploymentPatch";
import { DEFINITION_CHANGED_MESSAGE, isResourcesChanged, useAssistantDeploymentPatch } from "./useAssistantDeploymentPatch";

import { act, renderHook } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type Container = ReturnType<typeof DEPENDENCIES.useServices>;

const SEAL_CONTEXT: SdlSecretsSealContext = { kid: "k-1", sub: "user-1", jwk: { kty: "RSA", n: "n", e: "AQAB" } };
const SERVICES = { web: { image: "nginx:2" } };

describe(useAssistantDeploymentPatch.name, () => {
  it("patches in the background with an empty seal and the version the card was built from, like the update tab", async () => {
    const { patch, patchDeployment, sealSdlSecrets, markOutcomeHandled, forgetEarlierOutcomes, queryClient } = setup();

    await act(() => patch({ dseq: "42", services: SERVICES, ifManifestVersion: "v1" }));

    expect(sealSdlSecrets).toHaveBeenCalledWith({ context: SEAL_CONTEXT, secrets: {} });
    expect(patchDeployment).toHaveBeenCalledWith({
      dseq: "42",
      async: "true",
      data: { services: SERVICES, sealedSecrets: "empty-seal", ifManifestVersion: "v1" }
    });
    expect(forgetEarlierOutcomes).toHaveBeenCalledWith("deployment_update", "42");
    expect(markOutcomeHandled).not.toHaveBeenCalled();
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listActivities"] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "getDeployment", { dseq: "42" }] });
  });

  it("sends a seal the card made instead of sealing nothing", async () => {
    const { patch, patchDeployment, sealSdlSecrets } = setup();

    await act(() => patch({ dseq: "42", services: SERVICES, sealedSecrets: "secret-seal" }));

    expect(sealSdlSecrets).not.toHaveBeenCalled();
    expect(patchDeployment).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sealedSecrets: "secret-seal" }) }));
  });

  it("marks an update the api applied during the request as handled", async () => {
    const { patch, patchDeployment, markOutcomeHandled } = setup();
    patchDeployment.mockResolvedValue({ data: { manifestVersion: "v2" } });

    await act(() => patch({ dseq: "42", services: SERVICES }));

    expect(markOutcomeHandled).toHaveBeenCalledWith("deployment_update", "42", "succeeded");
  });

  it("seals again once when the api answers a stale sealing key", async () => {
    const { patch, patchDeployment, sealSdlSecrets } = setup();
    patchDeployment.mockRejectedValueOnce(new ApiError(409, { message: "stale key" }, "409"));

    await act(() => patch({ dseq: "42", services: SERVICES }));

    expect(sealSdlSecrets).toHaveBeenCalledTimes(2);
    expect(patchDeployment).toHaveBeenCalledTimes(2);
  });

  it("gives up after the second stale sealing key and marks the update failed", async () => {
    const { patch, patchDeployment, markOutcomeHandled } = setup();
    patchDeployment.mockRejectedValue(new ApiError(409, { message: "stale key" }, "409"));

    await act(() => expect(patch({ dseq: "42", services: SERVICES })).rejects.toThrow("409"));

    expect(patchDeployment).toHaveBeenCalledTimes(2);
    expect(markOutcomeHandled).toHaveBeenCalledWith("deployment_update", "42", "failed");
  });

  it("never reseals a value from a secure input, which is gone once sealed", async () => {
    const { patch, patchDeployment } = setup();
    patchDeployment.mockRejectedValue(new ApiError(409, { message: "stale key" }, "409"));

    await act(() => expect(patch({ dseq: "42", services: SERVICES, sealedSecrets: "secret-seal" })).rejects.toThrow("409"));

    expect(patchDeployment).toHaveBeenCalledTimes(1);
  });

  it("refuses with a short explanation and reloads the deployment when it changed since the card was shown", async () => {
    const { patch, patchDeployment, queryClient } = setup();
    patchDeployment.mockRejectedValue(new ApiError(409, { code: "deployment_definition_changed", message: "changed" }, "409"));

    await act(() => expect(patch({ dseq: "42", services: SERVICES, ifManifestVersion: "v1" })).rejects.toThrow(DEFINITION_CHANGED_MESSAGE));

    expect(patchDeployment).toHaveBeenCalledTimes(1);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "getDeployment", { dseq: "42" }] });
  });

  it("lets a stale provider version reach the card without resealing", async () => {
    const { patch, patchDeployment } = setup();
    patchDeployment.mockRejectedValue(new ApiError(409, { code: "provider_manifest_version_stale", message: "not yet" }, "409"));

    await act(() => expect(patch({ dseq: "42", services: SERVICES })).rejects.toThrow("409"));

    expect(patchDeployment).toHaveBeenCalledTimes(1);
  });

  it("lets other refusals reach the card as they are", async () => {
    const { patch, patchDeployment } = setup();
    const refusal = new ApiError(400, { message: "bad port" }, "400");
    patchDeployment.mockRejectedValue(refusal);

    await act(() => expect(patch({ dseq: "42", services: SERVICES })).rejects.toBe(refusal));
  });

  describe(isResourcesChanged.name, () => {
    it("recognizes a change that needs a new deployment", () => {
      expect(isResourcesChanged(new ApiError(422, { code: "deployment_resources_changed" }, "422"))).toBe(true);
      expect(isResourcesChanged(new ApiError(422, { code: "other" }, "422"))).toBe(false);
    });
  });

  function setup() {
    const getSDLSecretsContext = vi.fn(async () => ({ data: SEAL_CONTEXT }));
    const patchDeployment = vi.fn<(input: unknown) => Promise<{ data: Record<string, unknown> }>>(async () => ({
      data: { activityId: "activity-1", manifestVersion: "v2" }
    }));
    const api = createProxy({ v1: { getSDLSecretsContext, patchDeployment, getDeployment: vi.fn(), listActivities: vi.fn() } }) as unknown as Container["api"];
    const queryClient = mock<QueryClient>({ invalidateQueries: vi.fn(async () => undefined) });
    const forgetEarlierOutcomes = vi.fn();
    const markOutcomeHandled = vi.fn();
    const sealSdlSecrets = vi.fn<typeof DEPENDENCIES.sealSdlSecrets>(async () => "empty-seal");

    const { result } = renderHook(
      () =>
        useAssistantDeploymentPatch({
          useServices: () => Object.assign(mock<Container>(), { api }),
          useQueryClient: () => queryClient,
          useMarkActivityOutcomes: () => mock<ReturnType<typeof DEPENDENCIES.useMarkActivityOutcomes>>({ forgetEarlierOutcomes, markOutcomeHandled }),
          sealSdlSecrets
        }),
      { wrapper: ({ children }: { children: ReactNode }) => <TestContainerProvider>{children}</TestContainerProvider> }
    );

    return { patch: result.current, patchDeployment, sealSdlSecrets, markOutcomeHandled, forgetEarlierOutcomes, queryClient };
  }
});
