import type { TemplateOutput } from "@akashnetwork/http-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { SKIP_REPORTING_BELOW_SERVER_ERROR } from "@src/services/query-error-policy/query-error-policy";
import type { DEPENDENCIES } from "./useDeploymentTemplate";
import { useDeploymentTemplate } from "./useDeploymentTemplate";

import { waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useDeploymentTemplate.name, () => {
  it("loads the gallery template the deployment was created from", async () => {
    const template = mock<TemplateOutput>({ id: "akash-network-awesome-akash-comfyui", name: "ComfyUI" });
    const { result, getDeployment, usePublicTemplate } = setup({ templateId: "akash-network-awesome-akash-comfyui", template });

    await waitFor(() => expect(result.current.templateId).toBe("akash-network-awesome-akash-comfyui"));
    expect(getDeployment).toHaveBeenCalledWith({ dseq: "123" });
    expect(result.current.template).toMatchObject({ id: "akash-network-awesome-akash-comfyui", name: "ComfyUI" });
    expect(usePublicTemplate).toHaveBeenLastCalledWith("akash-network-awesome-akash-comfyui", expect.anything());
  });

  it("looks up no template for a deployment not created from one", async () => {
    const { result, getDeployment, usePublicTemplate } = setup({ templateId: null });

    await waitFor(() => expect(getDeployment).toHaveBeenCalled());
    expect(result.current).toEqual({ templateId: undefined, template: undefined });
    expect(usePublicTemplate).toHaveBeenLastCalledWith(undefined, expect.anything());
  });

  it("looks up no template for a deployment the console recorded nothing for", async () => {
    const { result, getDeployment } = setup({ consoleSettings: null });

    await waitFor(() => expect(getDeployment).toHaveBeenCalled());
    expect(result.current.templateId).toBeUndefined();
  });

  it("keeps a template the gallery no longer has out of error reporting", async () => {
    const { usePublicTemplate } = setup({ templateId: "akash-network-awesome-akash-removed" });

    await waitFor(() => expect(usePublicTemplate).toHaveBeenLastCalledWith("akash-network-awesome-akash-removed", { meta: SKIP_REPORTING_BELOW_SERVER_ERROR }));
  });

  it("reads nothing before the deployment is known", () => {
    const { getDeployment } = setup({ dseq: "", templateId: "akash-network-awesome-akash-comfyui" });

    expect(getDeployment).not.toHaveBeenCalled();
  });

  function setup(input: { dseq?: string; templateId?: string | null; consoleSettings?: null; template?: TemplateOutput }) {
    const consoleSettings = input.consoleSettings === null ? null : { sdl: "version: '2.0'", manifestVersion: "BAUG", templateId: input.templateId ?? null };
    const getDeployment = vi.fn(() => Promise.resolve({ data: { deployment: { hash: "BAUG" }, name: null, consoleSettings } }));
    const api = createProxy({ v1: { getDeployment } }) as unknown as ApiService;
    const usePublicTemplate = vi.fn((id: string | undefined) =>
      mock<ReturnType<typeof DEPENDENCIES.usePublicTemplate>>({ data: id ? input.template : undefined })
    );
    const services = { api } satisfies Partial<ReturnType<typeof DEPENDENCIES.useServices>>;
    const useServices: typeof DEPENDENCIES.useServices = () => services as unknown as ReturnType<typeof DEPENDENCIES.useServices>;

    const { result } = setupQuery(
      () => useDeploymentTemplate(input.dseq ?? "123", { useServices, usePublicTemplate: usePublicTemplate as typeof DEPENDENCIES.usePublicTemplate }),
      { services: { api: () => api } }
    );

    return { result, getDeployment, usePublicTemplate };
  }
});
