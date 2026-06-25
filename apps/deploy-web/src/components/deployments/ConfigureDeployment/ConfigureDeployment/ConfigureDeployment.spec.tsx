import type { TemplateOutput } from "@akashnetwork/http-sdk";
import { createStore, Provider as JotaiStoreProvider } from "jotai";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import sdlStore from "@src/store/sdlStore";
import type { TemplateCreation } from "@src/types";
import { helloWorldTemplate } from "@src/utils/templates";
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

  function setup(input: {
    templateId: string | null;
    template?: { isLoading?: boolean; isError?: boolean; data?: TemplateOutput };
    deploySdl?: TemplateCreation | null;
  }) {
    const ConfigureDeploymentForm = vi.fn(() => <div data-testid="form-mock" />);
    const enqueueSnackbar = vi.fn();
    const usePublicTemplate = vi.fn(() => mock<ReturnType<typeof DEPENDENCIES.usePublicTemplate>>(input.template as never));
    const params = new URLSearchParams(input.templateId ? { templateId: input.templateId } : {});

    const dependencies: typeof DEPENDENCIES = {
      Layout: vi.fn(({ children }) => <div data-testid="layout-mock">{children}</div>) as never,
      NextSeo: vi.fn(() => null) as never,
      ConfigureDeploymentForm: ConfigureDeploymentForm as never,
      usePublicTemplate: usePublicTemplate as never,
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

    return { ConfigureDeploymentForm, usePublicTemplate, enqueueSnackbar };
  }
});
