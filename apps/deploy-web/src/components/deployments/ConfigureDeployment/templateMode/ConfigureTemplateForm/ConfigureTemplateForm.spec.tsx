import type { ReactElement, ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeployTarget } from "@src/hooks/useDeployTarget/useDeployTarget";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { MarketplaceTemplate, TemplateAskedValue } from "@src/types/marketplace-template";
import { importDeploymentState } from "../../importDeploymentState/importDeploymentState";
import type { DeploymentIntent } from "../../useDeploymentFlow/deploymentIntent";
import { useTemplateMode } from "../TemplateModeProvider/TemplateModeProvider";
import { ConfigureTemplateForm, DEPENDENCIES } from "./ConfigureTemplateForm";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildProject } from "@tests/seeders/project";
import { buildMarketplaceTemplate, buildTemplateVersion } from "@tests/seeders/userTemplate";
import { MockComponents } from "@tests/unit/mocks";

const SDL = `version: "2.0"
services:
  web:
    image: ghcr.io/berriai/litellm:main-v1.52.0
    env:
      - MODEL=gpt-4o-mini
      - API_KEY=ac-secret://API_KEY
      - LOG_LEVEL=info
    expose:
      - port: 4000
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 1
        memory:
          size: 2Gi
        storage:
          size: 5Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

const MODEL_ASKED: TemplateAskedValue = {
  key: "MODEL",
  label: "Model",
  type: "text",
  default: "gpt-4o-mini",
  required: false,
  help: "Which model LiteLLM serves.",
  bindings: [{ service: "web", env: "MODEL" }]
};

const NEW_INTENT: DeploymentIntent = { templateMode: "new", draftId: "draft-1", sdlStrategy: "edit", bidStrategy: "select", vm: false, exampleImage: false };

describe(ConfigureTemplateForm.name, () => {
  it("saves a new template with only a title and opens its page", async () => {
    const { createTemplate, draft, router, allowLeaving, project } = setup({ intent: NEW_INTENT });

    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    const dialog = within(screen.getByRole("dialog", { name: "Save template" }));
    fireEvent.change(dialog.getByRole("textbox", { name: "Title" }), { target: { value: "Support chat" } });
    await act(() => fireEvent.click(dialog.getByRole("button", { name: "Save template" })));

    expect(createTemplate).toHaveBeenCalledTimes(1);
    const { data } = createTemplate.mock.calls[0][0];
    expect(data).toMatchObject({ title: "Support chat", projectId: project.id });
    expect(data.summary).toBeUndefined();
    expect(data.copiedFromId).toBeUndefined();
    expect(data.sdl).toContain("image: ghcr.io/berriai/litellm:main-v1.52.0");
    expect(data.askedValues).toEqual([{ key: "API_KEY", label: "API key", type: "secret", required: true, bindings: [{ service: "web", env: "API_KEY" }] }]);
    expect(draft.clear).toHaveBeenCalled();
    expect(allowLeaving).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/template/tpl-created");
  });

  it("sends the summary and the template it was copied from", async () => {
    const { createTemplate } = setup({ intent: { ...NEW_INTENT, copyFromTemplateId: "tpl-source", copyFromVersion: 2 } });

    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    const dialog = within(screen.getByRole("dialog", { name: "Save template" }));
    fireEvent.change(dialog.getByRole("textbox", { name: "Title" }), { target: { value: "Support chat" } });
    fireEvent.change(dialog.getByRole("textbox", { name: /Summary/ }), { target: { value: "Chat through one key." } });
    await act(() => fireEvent.click(dialog.getByRole("button", { name: "Save template" })));

    expect(createTemplate.mock.calls[0][0].data).toMatchObject({ summary: "Chat through one key.", copiedFromId: "tpl-source" });
  });

  it("never sends a typed secret value", async () => {
    const { createTemplate } = setup({ intent: NEW_INTENT });

    fireEvent.change(screen.getByRole("textbox", { name: "web API_KEY" }), { target: { value: "sk-typed-secret-value" } });
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    const dialog = within(screen.getByRole("dialog", { name: "Save template" }));
    fireEvent.change(dialog.getByRole("textbox", { name: "Title" }), { target: { value: "Support chat" } });
    await act(() => fireEvent.click(dialog.getByRole("button", { name: "Save template" })));

    const input = createTemplate.mock.calls[0][0];
    expect(JSON.stringify(input)).not.toContain("sk-typed-secret-value");
    expect(input.data.sdl).toContain("API_KEY=ac-secret://API_KEY");
  });

  it("saves the values the author asks the deployer for", async () => {
    const { createTemplate } = setup({ intent: NEW_INTENT });

    fireEvent.click(screen.getByRole("button", { name: "Ask for MODEL" }));
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    const dialog = within(screen.getByRole("dialog", { name: "Save template" }));
    expect(dialog.getByText("Model, API key")).toBeInTheDocument();
    expect(dialog.getByText("LOG_LEVEL")).toBeInTheDocument();
    fireEvent.change(dialog.getByRole("textbox", { name: "Title" }), { target: { value: "Support chat" } });
    await act(() => fireEvent.click(dialog.getByRole("button", { name: "Save template" })));

    expect(createTemplate.mock.calls[0][0].data.askedValues.map((value: TemplateAskedValue) => value.key)).toEqual(["MODEL", "API_KEY"]);
  });

  it("counts the values asked to the deployer in the header", () => {
    setup({ intent: NEW_INTENT });

    expect(screen.getByText("1 value")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ask for MODEL" }));

    expect(screen.getByText("2 values")).toBeInTheDocument();
    expect(screen.getByText("1 service · 1 vCPU · 2 GiB")).toBeInTheDocument();
  });

  it("prefills the title from the deployment name", () => {
    setup({ intent: NEW_INTENT, initialName: "support-bot" });

    expect(screen.getByText(/as a template\. Bids and pricing are hidden\./)).toHaveTextContent("Saving support-bot as a template.");
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    const dialog = within(screen.getByRole("dialog", { name: "Save template" }));

    expect(dialog.getByRole("textbox", { name: "Title" })).toHaveValue("support-bot");
    expect(dialog.getByText("From the deployment name")).toBeInTheDocument();
    expect(dialog.getByText("1 service from support-bot")).toBeInTheDocument();
  });

  it("files the new template in the chosen project", () => {
    const { project } = setup({ intent: NEW_INTENT });

    fireEvent.click(screen.getByRole("button", { name: "Save template" }));

    expect(screen.getByText(`Saved as Private in ${project.name}. Make it available to your organization from the template page.`)).toBeInTheDocument();
  });

  it("goes back to the deployment the template is saved from", () => {
    const { router } = setup({ intent: NEW_INTENT, initialName: "support-bot" });

    fireEvent.click(screen.getByRole("button", { name: "Back to deployment" }));

    expect(router.back).toHaveBeenCalled();
  });

  it("saves a new version from the current one in edit mode", async () => {
    const { createVersion, createTemplate, draft, router, allowLeaving } = setup({ template: { version: 4 } });

    await act(() => fireEvent.click(screen.getByRole("button", { name: "Save new version" })));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(createTemplate).not.toHaveBeenCalled();
    expect(createVersion).toHaveBeenCalledWith({
      id: "tpl-9",
      data: { sdl: expect.stringContaining("API_KEY=ac-secret://API_KEY"), askedValues: expect.any(Array), baseVersion: 4 }
    });
    expect(draft.clear).toHaveBeenCalled();
    expect(allowLeaving).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/template/tpl-9?tab=versions");
  });

  it("restores the template's asked values in edit mode", async () => {
    const { createVersion } = setup({ template: { version: 4, askedValues: [structuredClone(MODEL_ASKED)] } });

    expect(screen.getByText("2 values")).toBeInTheDocument();
    await act(() => fireEvent.click(screen.getByRole("button", { name: "Save new version" })));

    const { askedValues } = createVersion.mock.calls[0][0].data;
    expect(askedValues).toContainEqual(MODEL_ASKED);
  });

  it("shows the conflict toast when a newer version exists", async () => {
    const { enqueueSnackbar, router } = setup({ template: { version: 4 }, saveError: new ApiError(409, { message: "Conflict" }, "POST → 409") });

    await act(() => fireEvent.click(screen.getByRole("button", { name: "Save new version" })));

    expect(router.push).not.toHaveBeenCalled();
    render(enqueueSnackbar.mock.calls[0][0] as ReactElement);
    expect(screen.getByText("Someone saved a newer version of this template")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open template" })).toHaveAttribute("href", "/template/tpl-9");
  });

  it("shows why the api refused the template", async () => {
    const refusal = new ApiError(
      400,
      { code: "template_invalid", message: "The template is invalid", data: { issues: ['Env "API_KEY" in service "web" holds a secret value'] } },
      "POST → 400"
    );
    const { enqueueSnackbar, router } = setup({ intent: NEW_INTENT, saveError: refusal });

    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    const dialog = within(screen.getByRole("dialog", { name: "Save template" }));
    fireEvent.change(dialog.getByRole("textbox", { name: "Title" }), { target: { value: "Support chat" } });
    await act(() => fireEvent.click(dialog.getByRole("button", { name: "Save template" })));

    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Save template" })).toBeInTheDocument();
    render(enqueueSnackbar.mock.calls[0][0] as ReactElement);
    expect(screen.getByText("Couldn't save the template")).toBeInTheDocument();
    expect(screen.getByText('Env "API_KEY" in service "web" holds a secret value')).toBeInTheDocument();
  });

  it("asks to try again when the save fails for another reason", async () => {
    const { enqueueSnackbar } = setup({ template: { version: 4 }, saveError: new Error("network down") });

    await act(() => fireEvent.click(screen.getByRole("button", { name: "Save new version" })));

    render(enqueueSnackbar.mock.calls[0][0] as ReactElement);
    expect(screen.getByText("Couldn't save the template")).toBeInTheDocument();
    expect(screen.getByText("Try again in a moment.")).toBeInTheDocument();
  });

  it("shows every configure card, import and export", () => {
    const { ConfigureEditor, SdlImportExport, ResetConfigurationButton, SdlPreviewPane } = setup({ intent: NEW_INTENT });

    expect(ConfigureEditor.mock.lastCall?.[0]).toMatchObject({ title: "Template" });
    expect(SdlImportExport.mock.lastCall?.[0]).toMatchObject({
      variant: "toolbar",
      canImport: true,
      sdl: expect.stringContaining("image: ghcr.io/berriai/litellm")
    });
    expect(ResetConfigurationButton).toHaveBeenCalled();
    expect(SdlPreviewPane.mock.lastCall?.[0]).toMatchObject({
      isOpen: true,
      sdl: expect.stringContaining("image: ghcr.io/berriai/litellm"),
      footer: "Highlighted values are asked to the deployer. Secret values are never written into a template."
    });
  });

  it("asks before leaving once the configuration changed", () => {
    const { useConfirmLeave } = setup({ intent: NEW_INTENT });

    expect(useConfirmLeave).toHaveBeenLastCalledWith(false, "Leave without saving? Your changes to this template will be lost.");
    fireEvent.change(screen.getByRole("textbox", { name: "web LOG_LEVEL" }), { target: { value: "debug" } });

    expect(useConfirmLeave).toHaveBeenLastCalledWith(true, "Leave without saving? Your changes to this template will be lost.");
  });

  it("asks before leaving once an asked value changed", () => {
    const { useConfirmLeave } = setup({ intent: NEW_INTENT });

    fireEvent.click(screen.getByRole("button", { name: "Ask for MODEL" }));

    expect(useConfirmLeave).toHaveBeenLastCalledWith(true, expect.any(String));
  });

  it("keeps the working SDL in the draft", () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { draft } = setup({ intent: NEW_INTENT, initialName: "support-bot" });

    act(() => vi.advanceTimersByTime(300));

    expect(draft.save).toHaveBeenLastCalledWith(
      expect.stringContaining("image: ghcr.io/berriai/litellm"),
      "support-bot",
      undefined,
      expect.stringContaining("API_KEY=ac-secret://API_KEY"),
      {}
    );
  });

  it("replaces the configuration with an imported SDL", () => {
    const { SdlImportExport, SdlImportChangesBanner } = setup({ intent: NEW_INTENT });
    const importState = SdlImportExport.mock.lastCall?.[0].onImport;

    act(() =>
      importState?.({
        ...importDeploymentState(SDL.replace("image: ghcr.io/berriai/litellm:main-v1.52.0", "image: nginx:1.27")),
        changes: ["Pricing was dropped"]
      })
    );

    expect(SdlImportExport.mock.lastCall?.[0]).toMatchObject({ sdl: expect.stringContaining("image: nginx:1.27") });
    expect(SdlImportChangesBanner.mock.lastCall?.[0]).toMatchObject({ changes: ["Pricing was dropped"] });
  });

  it("resets to the configuration it started from", () => {
    const { SdlImportExport, ResetConfigurationButton } = setup({ intent: NEW_INTENT });
    fireEvent.change(screen.getByRole("textbox", { name: "web LOG_LEVEL" }), { target: { value: "debug" } });
    expect(SdlImportExport.mock.lastCall?.[0]).toMatchObject({ sdl: expect.stringContaining("LOG_LEVEL=debug") });

    act(() => ResetConfigurationButton.mock.lastCall?.[0].onReset());

    expect(SdlImportExport.mock.lastCall?.[0]).toMatchObject({ sdl: expect.stringContaining("LOG_LEVEL=info") });
  });

  it("saves a new template without a project when none needs choosing", async () => {
    const { createTemplate } = setup({ intent: NEW_INTENT, hasNoProject: true });

    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    const dialog = within(screen.getByRole("dialog", { name: "Save template" }));
    expect(dialog.getByText("Saved as Private. Make it available to your organization from the template page.")).toBeInTheDocument();
    fireEvent.change(dialog.getByRole("textbox", { name: "Title" }), { target: { value: "Support chat" } });
    await act(() => fireEvent.click(dialog.getByRole("button", { name: "Save template" })));

    expect(createTemplate.mock.calls[0][0].data.projectId).toBeUndefined();
  });

  it("goes back to the configuration from the save dialog", () => {
    setup({ intent: NEW_INTENT });

    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to configuration" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("credits no deployment for a copied template", () => {
    setup({ intent: { ...NEW_INTENT, copyFromTemplateId: "tpl-source", copyFromVersion: 2 }, initialName: "support-bot" });

    expect(screen.queryByText(/Bids and pricing are hidden/)).not.toBeInTheDocument();
  });

  it("shows the project chip only for a new template", () => {
    const creating = setup({ intent: NEW_INTENT });
    expect(creating.ConfigureDeployTargetChip).toHaveBeenCalled();
    cleanup();

    const editing = setup({ template: { version: 4 } });

    expect(editing.ConfigureDeployTargetChip).not.toHaveBeenCalled();
  });

  it("holds the save while a new template is being saved", () => {
    setup({ intent: NEW_INTENT, pendingSave: "template" });

    expect(screen.getByRole("button", { name: /Save template/ })).toBeDisabled();
  });

  it("holds the save while a new version is being saved", () => {
    setup({ template: { version: 4 }, pendingSave: "version" });

    expect(screen.getByRole("button", { name: /Save new version/ })).toBeDisabled();
  });

  it("saves the first version of a template that has none", async () => {
    const { createVersion } = setup({ template: { version: null } });

    await act(() => fireEvent.click(screen.getByRole("button", { name: "Save new version" })));

    expect(createVersion.mock.calls[0][0].data.baseVersion).toBeUndefined();
  });

  it("shows a refused version's reason rather than the conflict", async () => {
    const refusal = new ApiError(400, { code: "template_invalid", message: "Invalid", data: { issues: ['Variable "MODEL" is declared twice'] } }, "POST → 400");
    const { enqueueSnackbar } = setup({ template: { version: 4 }, saveError: refusal });

    await act(() => fireEvent.click(screen.getByRole("button", { name: "Save new version" })));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
    render(enqueueSnackbar.mock.calls[0][0] as ReactElement);
    expect(screen.getByText('Variable "MODEL" is declared twice')).toBeInTheDocument();
    expect(screen.queryByText("Someone saved a newer version of this template")).not.toBeInTheDocument();
  });

  it("dismisses the conflict toast when its template is opened", async () => {
    const { enqueueSnackbar, closeSnackbar } = setup({ template: { version: 4 }, saveError: new ApiError(409, { message: "Conflict" }, "POST → 409") });

    await act(() => fireEvent.click(screen.getByRole("button", { name: "Save new version" })));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "warning" }));
    render(enqueueSnackbar.mock.calls[0][0] as ReactElement);
    const stayOnPage = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("click", stayOnPage);
    onTestFinished(() => window.removeEventListener("click", stayOnPage));
    fireEvent.click(screen.getByRole("link", { name: "Open template" }));
    expect(closeSnackbar).toHaveBeenCalledWith("toast-key");
  });

  it("closes and reopens the SDL preview", () => {
    const { SdlPreviewPane } = setup({ intent: NEW_INTENT });

    act(() => SdlPreviewPane.mock.lastCall?.[0].onClose());
    expect(SdlPreviewPane.mock.lastCall?.[0].isOpen).toBe(false);

    act(() => SdlPreviewPane.mock.lastCall?.[0].onOpen());
    expect(SdlPreviewPane.mock.lastCall?.[0].isOpen).toBe(true);
  });

  it("dismisses the import changes", () => {
    const { SdlImportExport, SdlImportChangesBanner } = setup({ intent: NEW_INTENT });
    expect(SdlImportChangesBanner).not.toHaveBeenCalled();

    act(() => SdlImportExport.mock.lastCall?.[0].onImport({ ...importDeploymentState(SDL), changes: ["Pricing was dropped"] }));
    act(() => SdlImportChangesBanner.mock.lastCall?.[0].onDismiss());
    const rendersBeforeEdit = SdlImportChangesBanner.mock.calls.length;
    fireEvent.change(screen.getByRole("textbox", { name: "web LOG_LEVEL" }), { target: { value: "debug" } });

    expect(SdlImportChangesBanner).toHaveBeenCalledTimes(rendersBeforeEdit);
  });

  it("puts an imported SDL's values in the editor", () => {
    const { SdlImportExport } = setup({ intent: NEW_INTENT });

    act(() => SdlImportExport.mock.lastCall?.[0].onImport(importDeploymentState(SDL.replace("LOG_LEVEL=info", "LOG_LEVEL=warn"))));

    expect(screen.getByRole("textbox", { name: "web LOG_LEVEL" })).toHaveValue("warn");
  });

  it("resets a restored draft to the configuration its session started from", () => {
    const { SdlImportExport, ResetConfigurationButton } = setup({
      intent: NEW_INTENT,
      restoredDraft: { sdl: SDL.replace("LOG_LEVEL=info", "LOG_LEVEL=debug"), startingSdl: SDL.replace("LOG_LEVEL=info", "LOG_LEVEL=trace") }
    });
    expect(SdlImportExport.mock.lastCall?.[0].sdl).toContain("LOG_LEVEL=debug");

    act(() => ResetConfigurationButton.mock.lastCall?.[0].onReset());

    expect(SdlImportExport.mock.lastCall?.[0].sdl).toContain("LOG_LEVEL=trace");
  });

  it("keeps a blank template in the draft without a name or starting SDL", () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { draft, SdlPreviewPane } = setup({ intent: NEW_INTENT, hasNoInitialSdl: true });

    act(() => vi.advanceTimersByTime(300));

    expect(draft.save).toHaveBeenLastCalledWith(expect.stringContaining('version: "2.0"'), "", undefined, undefined, {});
    expect(SdlPreviewPane.mock.lastCall?.[0].sdl).toContain('version: "2.0"');
  });

  it("previews the SDL once typing settles", () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const { SdlPreviewPane } = setup({ intent: NEW_INTENT });
    fireEvent.change(screen.getByRole("textbox", { name: "web LOG_LEVEL" }), { target: { value: "debug" } });
    expect(SdlPreviewPane.mock.lastCall?.[0].sdl).toContain("LOG_LEVEL=info");

    act(() => vi.advanceTimersByTime(300));

    expect(SdlPreviewPane.mock.lastCall?.[0].sdl).toContain("LOG_LEVEL=debug");
  });

  function setup(input: {
    intent?: DeploymentIntent;
    initialName?: string;
    template?: { version: number | null; askedValues?: TemplateAskedValue[] };
    saveError?: unknown;
    hasNoInitialSdl?: boolean;
    restoredDraft?: { sdl: string; startingSdl: string };
    hasNoProject?: boolean;
    pendingSave?: "template" | "version";
  }) {
    const template: MarketplaceTemplate | undefined = input.template
      ? buildMarketplaceTemplate({
          id: "tpl-9",
          title: "Support chat",
          canEdit: true,
          currentVersion:
            input.template.version === null
              ? null
              : buildTemplateVersion({
                  templateId: "tpl-9",
                  version: input.template.version,
                  sdl: SDL,
                  askedValues: input.template.askedValues ?? []
                })
        })
      : undefined;
    const intent: DeploymentIntent = input.intent ?? { ...NEW_INTENT, templateMode: "edit", userTemplateId: "tpl-9" };
    const project = buildProject({ name: "support-tools" });
    const createTemplate = vi.fn(async (_input: { data: Record<string, any> }) => {
      if (input.saveError) throw input.saveError;
      return { data: buildMarketplaceTemplate({ id: "tpl-created" }) };
    });
    const createVersion = vi.fn(async (_input: { id: string; data: Record<string, any> }) => {
      if (input.saveError) throw input.saveError;
      return { data: buildMarketplaceTemplate({ id: "tpl-9" }) };
    });
    const createTemplateMutation = mock<ReturnType<typeof DEPENDENCIES.useCreateTemplateMutation>>({
      mutateAsync: createTemplate as never,
      isPending: input.pendingSave === "template"
    });
    const createVersionMutation = mock<ReturnType<typeof DEPENDENCIES.useCreateTemplateVersionMutation>>({
      mutateAsync: createVersion as never,
      isPending: input.pendingSave === "version"
    });
    const draft = mock<ReturnType<typeof DEPENDENCIES.useConfigureDraft>>({
      draftId: "draft-1",
      isLoading: false,
      persistedSdl: input.restoredDraft?.sdl,
      persistedStartingSdl: input.restoredDraft?.startingSdl,
      persistedPlacementRegions: undefined
    });
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
    const enqueueSnackbar = vi.fn<(message: ReactNode, options?: Record<string, unknown>) => string>(() => "toast-key");
    const closeSnackbar = vi.fn();
    const snackbar = mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar, closeSnackbar });
    const deployTarget = mock<DeployTarget>({ project: input.hasNoProject ? undefined : project });
    const ConfigureDeployTargetChip = vi.fn<typeof DEPENDENCIES.ConfigureDeployTargetChip>(() => null);
    const allowLeaving = vi.fn();
    const useConfirmLeave = vi.fn<typeof DEPENDENCIES.useConfirmLeave>(() => allowLeaving);
    const ConfigureEditor = vi.fn<typeof DEPENDENCIES.ConfigureEditor>(EditorMock);
    const SdlImportExport = vi.fn<typeof DEPENDENCIES.SdlImportExport>(() => null);
    const ResetConfigurationButton = vi.fn<typeof DEPENDENCIES.ResetConfigurationButton>(() => null);
    const SdlPreviewPane = vi.fn<typeof DEPENDENCIES.SdlPreviewPane>(() => null);
    const SdlImportChangesBanner = vi.fn<typeof DEPENDENCIES.SdlImportChangesBanner>(() => null);

    const dependencies = MockComponents(DEPENDENCIES, {
      Layout: (({ children }: { children: ReactNode }) => <>{children}</>) as typeof DEPENDENCIES.Layout,
      ConfigureTemplateHeader: DEPENDENCIES.ConfigureTemplateHeader,
      SaveTemplateDialog: DEPENDENCIES.SaveTemplateDialog,
      Snackbar: DEPENDENCIES.Snackbar,
      ConfigureEditor,
      SdlImportExport,
      ResetConfigurationButton,
      SdlPreviewPane,
      SdlImportChangesBanner,
      ConfigureDeployTargetChip,
      useConfigureDraft: () => draft,
      useConfigureDeployTarget: () => deployTarget,
      useCreateTemplateMutation: () => createTemplateMutation,
      useCreateTemplateVersionMutation: () => createVersionMutation,
      useRouter: () => router,
      useSnackbar: () => snackbar,
      useConfirmLeave
    });

    render(
      <ConfigureTemplateForm
        intent={intent}
        initialSdl={input.restoredDraft?.sdl ?? (input.hasNoInitialSdl ? undefined : template?.currentVersion?.sdl ?? SDL)}
        initialName={input.initialName ?? template?.title}
        template={template}
        askedValues={template?.currentVersion?.askedValues ?? []}
        dependencies={dependencies}
      />
    );

    return {
      createTemplate,
      createVersion,
      draft,
      router,
      enqueueSnackbar,
      closeSnackbar,
      ConfigureDeployTargetChip,
      allowLeaving,
      project,
      useConfirmLeave,
      ConfigureEditor,
      SdlImportExport,
      ResetConfigurationButton,
      SdlPreviewPane,
      SdlImportChangesBanner
    };
  }

  function EditorMock({ toolbar }: { toolbar: ReactNode }) {
    const { register, watch } = useFormContext<SdlBuilderFormValuesType>();
    const templateMode = useTemplateMode();
    const services = watch("services");

    return (
      <div>
        {toolbar}
        {services.map((service, serviceIndex) =>
          (service.env ?? []).map((variable, envIndex) => (
            <div key={variable.id}>
              <input aria-label={`${service.title} ${variable.key}`} {...register(`services.${serviceIndex}.env.${envIndex}.value`)} />
              <button type="button" onClick={() => templateMode?.setAsked(variable.key, true)}>
                Ask for {variable.key}
              </button>
            </div>
          ))
        )}
      </div>
    );
  }
});
