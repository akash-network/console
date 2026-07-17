import type { TemplateOutput } from "@akashnetwork/http-sdk";
import { createStore, Provider as JotaiStoreProvider } from "jotai";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import sdlStore from "@src/store/sdlStore";
import type { TemplateCreation } from "@src/types";
import { helloWorldTemplate } from "@src/utils/templates";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./ConfigureDeployment";
import { ConfigureDeployment } from "./ConfigureDeployment";

import { render, screen } from "@testing-library/react";

describe(ConfigureDeployment.name, () => {
  it("shows a loading state while the template is being fetched", () => {
    const { ConfigureDeploymentForm } = setup({ templateId: "tpl-1", template: { isLoading: true } });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(ConfigureDeploymentForm).not.toHaveBeenCalled();
  });

  it("hydrates the form from the fetched template's SDL", () => {
    const { ConfigureDeploymentForm } = setup({
      templateId: "tpl-1",
      template: { isLoading: false, data: mock<TemplateOutput>({ deploy: "version: '2.0'" }) }
    });

    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(expect.objectContaining({ initialSdl: "version: '2.0'" }), expect.anything());
  });

  it("surfaces an error and falls back to a default when the template can't be loaded", () => {
    const { ConfigureDeploymentForm, enqueueSnackbar } = setup({ templateId: "tpl-1", template: { isLoading: false, isError: true } });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(expect.objectContaining({ initialSdl: undefined }), expect.anything());
  });

  it("falls back to the carried-in deploySdl when no template id is present", () => {
    const { ConfigureDeploymentForm } = setup({ templateId: null, deploySdl: mock<TemplateCreation>({ content: "carried: sdl" }) });

    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(expect.objectContaining({ initialSdl: "carried: sdl" }), expect.anything());
  });

  it("does not query a template when no template id is present", () => {
    const { usePublicTemplate } = setup({ templateId: null });

    expect(usePublicTemplate).toHaveBeenCalledWith(undefined);
  });

  it("resolves a hardcoded template by code without fetching", () => {
    const { ConfigureDeploymentForm, usePublicTemplate } = setup({ templateId: helloWorldTemplate.code });

    expect(usePublicTemplate).toHaveBeenCalledWith(undefined);
    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(expect.objectContaining({ initialSdl: helloWorldTemplate.content }), expect.anything());
  });

  it("forwards the draft session's resolved id into the form's intent", () => {
    const { ConfigureDeploymentForm, useConfigureDraft } = setup({ templateId: null, draftId: "resolved-1" });

    expect(useConfigureDraft).toHaveBeenCalledWith(expect.objectContaining({ sdlStrategy: "edit", bidStrategy: "select" }));
    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(
      expect.objectContaining({ intent: expect.objectContaining({ draftId: "resolved-1" }) }),
      expect.anything()
    );
  });

  it("restores the draft's persisted SDL and skips the template fetch", () => {
    const { ConfigureDeploymentForm, usePublicTemplate } = setup({ templateId: "tpl-1", persistedSdl: "restored: sdl" });

    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(expect.objectContaining({ initialSdl: "restored: sdl" }), expect.anything());
    expect(usePublicTemplate).toHaveBeenCalledWith(undefined);
  });

  it("falls back to the template when the draft has nothing persisted", () => {
    const { ConfigureDeploymentForm, usePublicTemplate } = setup({
      templateId: "tpl-1",
      template: { isLoading: false, data: mock<TemplateOutput>({ deploy: "version: '2.0'" }) }
    });

    expect(usePublicTemplate).toHaveBeenCalledWith("tpl-1");
    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(expect.objectContaining({ initialSdl: "version: '2.0'" }), expect.anything());
  });

  it("defaults the deployment name to the fetched template's name", () => {
    const { ConfigureDeploymentForm } = setup({
      templateId: "tpl-1",
      template: { isLoading: false, data: mock<TemplateOutput>({ deploy: "version: '2.0'", name: "My Template" }) }
    });

    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(expect.objectContaining({ initialName: "My Template" }), expect.anything());
  });

  it("defaults the deployment name to a hardcoded template's name", () => {
    const { ConfigureDeploymentForm } = setup({ templateId: helloWorldTemplate.code });

    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(expect.objectContaining({ initialName: helloWorldTemplate.name }), expect.anything());
  });

  it("prefers the persisted draft name over the template name", () => {
    const { ConfigureDeploymentForm } = setup({ templateId: helloWorldTemplate.code, persistedName: "resumed-name" });

    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(expect.objectContaining({ initialName: "resumed-name" }), expect.anything());
  });

  it("ignores the carried-in deploySdl on a vm entry and forwards the vm intent", () => {
    const { ConfigureDeploymentForm } = setup({ templateId: null, vm: true, deploySdl: mock<TemplateCreation>({ content: "carried: sdl" }) });

    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(
      expect.objectContaining({ initialSdl: undefined, intent: expect.objectContaining({ vm: true }) }),
      expect.anything()
    );
  });

  it("still restores the draft's persisted SDL on a vm entry", () => {
    const { ConfigureDeploymentForm } = setup({ templateId: null, vm: true, persistedSdl: "restored: sdl" });

    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(expect.objectContaining({ initialSdl: "restored: sdl" }), expect.anything());
  });

  it("ignores a templateId carried alongside vm=true", () => {
    const { ConfigureDeploymentForm, usePublicTemplate } = setup({ templateId: helloWorldTemplate.code, vm: true });

    expect(usePublicTemplate).toHaveBeenCalledWith(undefined);
    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(expect.objectContaining({ initialSdl: undefined }), expect.anything());
  });

  it("routes an auto-deploy intent to the auto flow with the shared flow, not the manual form", () => {
    const { AutoDeployFlow, ConfigureDeploymentForm, DeploymentFlowProvider } = setup({
      templateId: helloWorldTemplate.code,
      sdlStrategy: "default",
      bidStrategy: "auto"
    });

    expect(ConfigureDeploymentForm).not.toHaveBeenCalled();
    expect(DeploymentFlowProvider).toHaveBeenCalledWith(
      expect.objectContaining({ intent: expect.objectContaining({ sdlStrategy: "default", bidStrategy: "auto" }) }),
      expect.anything()
    );
    expect(AutoDeployFlow).toHaveBeenCalledWith(expect.objectContaining({ sdl: helloWorldTemplate.content, flow: expect.anything() }), expect.anything());
  });

  function setup(input: {
    templateId?: string | null;
    sdlStrategy?: string;
    bidStrategy?: string;
    draftId?: string;
    persistedSdl?: string;
    persistedName?: string;
    template?: { isLoading?: boolean; isError?: boolean; data?: TemplateOutput };
    deploySdl?: TemplateCreation | null;
    vm?: boolean;
  }) {
    const ConfigureDeploymentForm = vi.fn(() => <div data-testid="form-mock" />);
    const AutoDeployFlow = vi.fn(() => <div data-testid="auto-mock" />);
    const DeploymentFlowProvider = vi.fn(({ children }) => (
      <>{children({ flow: mock<DeploymentFlow>(), isWalletReady: true, trialError: undefined, retryTrial: vi.fn() })}</>
    ));
    const enqueueSnackbar = vi.fn();
    const usePublicTemplate = vi.fn(() => mock<ReturnType<typeof DEPENDENCIES.usePublicTemplate>>(input.template as never));
    const save = vi.fn();
    const clear = vi.fn();
    const useConfigureDraft = vi.fn(() =>
      mock<ReturnType<typeof DEPENDENCIES.useConfigureDraft>>({
        draftId: input.draftId ?? "minted-id",
        persistedSdl: input.persistedSdl,
        persistedName: input.persistedName,
        save,
        clear
      })
    );

    const query: Record<string, string> = {};
    if (input.templateId) query.templateId = input.templateId;
    if (input.sdlStrategy) query["sdl-strategy"] = input.sdlStrategy;
    if (input.bidStrategy) query["bid-strategy"] = input.bidStrategy;
    if (input.vm) query.vm = "true";
    const params = new URLSearchParams(query);

    const dependencies: typeof DEPENDENCIES = {
      Layout: vi.fn(({ children }) => <div data-testid="layout-mock">{children}</div>) as never,
      NextSeo: vi.fn(() => null) as never,
      AutoDeployFlow: AutoDeployFlow as never,
      ConfigureDeploymentForm: ConfigureDeploymentForm as never,
      DeploymentFlowProvider: DeploymentFlowProvider as never,
      ResumeDeploymentGuard: vi.fn(({ children }) => <>{children({ activeLeases: [] })}</>) as never,
      usePublicTemplate: usePublicTemplate as never,
      useConfigureDraft: useConfigureDraft as never,
      useSearchParams: () => params as unknown as ReadonlyURLSearchParams,
      useParams: (() => ({})) as never,
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      Snackbar: vi.fn(() => null) as never
    };

    const store = createStore();
    store.set(sdlStore.deploySdl, input.deploySdl ?? null);

    render(
      <JotaiStoreProvider store={store}>
        <ConfigureDeployment dependencies={dependencies} />
      </JotaiStoreProvider>
    );

    return { ConfigureDeploymentForm, AutoDeployFlow, DeploymentFlowProvider, usePublicTemplate, useConfigureDraft, enqueueSnackbar };
  }
});
