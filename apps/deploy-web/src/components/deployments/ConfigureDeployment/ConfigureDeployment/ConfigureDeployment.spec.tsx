import type { PropsWithChildren } from "react";
import { useState } from "react";
import type { TemplateOutput } from "@akashnetwork/http-sdk";
import { createStore, Provider as JotaiStoreProvider } from "jotai";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useMarkAutoDeployStart, useTakeAutoDeployStart } from "@src/hooks/useAutoDeployStart/useAutoDeployStart";
import sdlStore from "@src/store/sdlStore";
import type { ITemplate, TemplateCreation } from "@src/types";
import { helloWorldTemplate } from "@src/utils/templates";
import type { ResumeResolution } from "../ResumeDeploymentGuard/ResumeDeploymentGuard";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./ConfigureDeployment";
import { ConfigureDeployment } from "./ConfigureDeployment";

import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";

const SECRET_REFERENCE_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "API_KEY=ac-secret://API_KEY"\n';

describe(ConfigureDeployment.name, () => {
  it("holds a new deployment behind the project gate", () => {
    const { DeployTargetGate } = setup({ templateId: "tpl-1" });

    expect(DeployTargetGate.mock.lastCall?.[0].filedDseq).toBeUndefined();
  });

  it("names a deployment that already exists to the project gate", () => {
    const { DeployTargetGate } = setup({ templateId: "tpl-1", dseq: "123" });

    expect(DeployTargetGate.mock.lastCall?.[0]).toMatchObject({ filedDseq: "123" });
  });

  it("shows a loading state while the template is being fetched", () => {
    const { ConfigureDeploymentForm } = setup({ templateId: "tpl-1", template: { isLoading: true } });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(ConfigureDeploymentForm).not.toHaveBeenCalled();
  });

  it("shows a loading state while a resumed draft is read, fetching no template meanwhile", () => {
    const { ConfigureDeploymentForm, usePublicTemplate, ResumeDeploymentGuard } = setup({ templateId: "tpl-1", draftId: "resumed", isDraftLoading: true });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(ConfigureDeploymentForm).not.toHaveBeenCalled();
    expect(ResumeDeploymentGuard).not.toHaveBeenCalled();
    expect(usePublicTemplate).toHaveBeenLastCalledWith(undefined);
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

  it("opens a draft handed over while the screen is open on a fresh form and flow seeded from it", () => {
    const { ConfigureDeploymentForm, handOverDraft } = setup({ draftId: "open-session" });
    const firstFlow = ConfigureDeploymentForm.mock.lastCall?.[0].flow;

    handOverDraft({ draftId: "handed-over", sdl: "assistant: sdl", name: "nginx-api" });

    expect(ConfigureDeploymentForm).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialSdl: "assistant: sdl", initialName: "nginx-api", intent: expect.objectContaining({ draftId: "handed-over" }) }),
      expect.anything()
    );
    expect(ConfigureDeploymentForm.mock.lastCall?.[0].flow).not.toBe(firstFlow);
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

  it("ignores the carried-in deploySdl on an example image entry and forwards the example image intent", () => {
    const { ConfigureDeploymentForm } = setup({ templateId: null, exampleImage: true, deploySdl: mock<TemplateCreation>({ content: "carried: sdl" }) });

    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(
      expect.objectContaining({ initialSdl: undefined, intent: expect.objectContaining({ exampleImage: true }) }),
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
      bidStrategy: "auto",
      autoDeployStart: helloWorldTemplate.code
    });

    expect(ConfigureDeploymentForm).not.toHaveBeenCalled();
    expect(DeploymentFlowProvider).toHaveBeenCalledWith(
      expect.objectContaining({ intent: expect.objectContaining({ sdlStrategy: "default", bidStrategy: "auto" }) }),
      expect.anything()
    );
    expect(AutoDeployFlow).toHaveBeenCalledWith(expect.objectContaining({ sdl: helloWorldTemplate.content, flow: expect.anything() }), expect.anything());
  });

  it("opens the manual form with the template loaded when an auto-deploy link arrives without a console deploy button", () => {
    const { AutoDeployFlow, ConfigureDeploymentForm, DeploymentFlowProvider } = setup({
      templateId: helloWorldTemplate.code,
      sdlStrategy: "default",
      bidStrategy: "auto"
    });

    expect(AutoDeployFlow).not.toHaveBeenCalled();
    expect(DeploymentFlowProvider).toHaveBeenCalledWith(
      expect.objectContaining({ intent: expect.objectContaining({ sdlStrategy: "edit" }) }),
      expect.anything()
    );
    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(
      expect.objectContaining({
        initialSdl: helloWorldTemplate.content,
        intent: expect.objectContaining({ templateId: helloWorldTemplate.code, sdlStrategy: "edit" })
      }),
      expect.anything()
    );
  });

  it("opens the manual form when a console deploy button marked another template", () => {
    const { AutoDeployFlow, ConfigureDeploymentForm } = setup({
      templateId: helloWorldTemplate.code,
      sdlStrategy: "default",
      bidStrategy: "auto",
      autoDeployStart: "tpl-1"
    });

    expect(AutoDeployFlow).not.toHaveBeenCalled();
    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(
      expect.objectContaining({ intent: expect.objectContaining({ sdlStrategy: "edit" }) }),
      expect.anything()
    );
  });

  it("lets the resume guard re-send a leased deployment's manifest only for a console started deploy", () => {
    const { ResumeDeploymentGuard } = setup({
      templateId: helloWorldTemplate.code,
      sdlStrategy: "default",
      bidStrategy: "auto",
      autoDeployStart: helloWorldTemplate.code
    });

    expect(ResumeDeploymentGuard).toHaveBeenCalledWith(expect.objectContaining({ canResume: true }), expect.anything());
  });

  it("sends a link naming an existing deployment through the resume guard without letting it re-send the manifest", () => {
    const { ResumeDeploymentGuard, AutoDeployFlow } = setup({
      templateId: helloWorldTemplate.code,
      sdlStrategy: "default",
      bidStrategy: "auto",
      dseq: "123"
    });

    expect(ResumeDeploymentGuard).toHaveBeenCalledWith(
      expect.objectContaining({ canResume: false, intent: expect.objectContaining({ dseq: "123", sdlStrategy: "edit" }) }),
      expect.anything()
    );
    expect(AutoDeployFlow).not.toHaveBeenCalled();
  });

  it("auto deploys, on a fresh flow, the template a deploy button inside the manual form marks, like the smaller model offered for a blocked GPU", () => {
    const { AutoDeployFlow, ConfigureDeploymentForm, navigate } = setup({
      templateId: "tpl-1",
      template: { isLoading: false, isError: false, data: mock<TemplateOutput>({ deploy: "version: '2.0'" }) },
      deployButtonInForm: helloWorldTemplate.code
    });
    const formFlow = ConfigureDeploymentForm.mock.lastCall?.[0].flow;

    fireEvent.click(screen.getByRole("button", { name: `Deploy ${helloWorldTemplate.code}` }));
    navigate({ templateId: helloWorldTemplate.code, sdlStrategy: "default", bidStrategy: "auto" });

    expect(AutoDeployFlow).toHaveBeenLastCalledWith(expect.objectContaining({ sdl: helloWorldTemplate.content }), expect.anything());
    expect(AutoDeployFlow.mock.lastCall?.[0].flow).not.toBe(formFlow);
  });

  it("auto deploys, on a fresh flow, a template Deploy now marks over a configure screen deploying another one", () => {
    const { AutoDeployFlow, markAutoDeployStart, navigate } = setup({
      templateId: "tpl-1",
      sdlStrategy: "default",
      bidStrategy: "auto",
      autoDeployStart: "tpl-1",
      template: { isLoading: false, isError: false, data: mock<TemplateOutput>({ deploy: "version: '2.0'" }) }
    });
    const firstFlow = AutoDeployFlow.mock.lastCall?.[0].flow;

    markAutoDeployStart(helloWorldTemplate.code);
    navigate({ templateId: helloWorldTemplate.code, sdlStrategy: "default", bidStrategy: "auto" });

    expect(AutoDeployFlow).toHaveBeenLastCalledWith(expect.objectContaining({ sdl: helloWorldTemplate.content }), expect.anything());
    expect(AutoDeployFlow.mock.lastCall?.[0].flow).not.toBe(firstFlow);
  });

  it("keeps the form for a same-page push with no mark, even to a template the screen started earlier", () => {
    const { AutoDeployFlow, ConfigureDeploymentForm, navigate } = setup({
      templateId: helloWorldTemplate.code,
      sdlStrategy: "default",
      bidStrategy: "auto",
      autoDeployStart: helloWorldTemplate.code,
      template: { isLoading: false, isError: false, data: mock<TemplateOutput>({ deploy: "version: '2.0'" }) }
    });
    navigate({ templateId: "tpl-1" });
    AutoDeployFlow.mockClear();

    navigate({ templateId: helloWorldTemplate.code, sdlStrategy: "default", bidStrategy: "auto" });

    expect(AutoDeployFlow).not.toHaveBeenCalled();
    expect(ConfigureDeploymentForm).toHaveBeenLastCalledWith(
      expect.objectContaining({ intent: expect.objectContaining({ templateId: helloWorldTemplate.code, sdlStrategy: "edit" }) }),
      expect.anything()
    );
  });

  it("auto deploys, on a fresh flow, the template already shown when Deploy now marks it over a manual screen that hasn't started deploying", () => {
    const { AutoDeployFlow, ConfigureDeploymentForm, markAutoDeployStart, navigate } = setup({ templateId: helloWorldTemplate.code });
    const formFlow = ConfigureDeploymentForm.mock.lastCall?.[0].flow;

    markAutoDeployStart(helloWorldTemplate.code);
    navigate({ templateId: helloWorldTemplate.code, sdlStrategy: "default", bidStrategy: "auto" });

    expect(AutoDeployFlow).toHaveBeenLastCalledWith(expect.objectContaining({ sdl: helloWorldTemplate.content }), expect.anything());
    expect(AutoDeployFlow.mock.lastCall?.[0].flow).not.toBe(formFlow);
  });

  it("doesn't start a second deployment when Deploy again marks the template the screen is deploying", () => {
    const { AutoDeployFlow, markAutoDeployStart, navigate } = setup({
      templateId: helloWorldTemplate.code,
      sdlStrategy: "default",
      bidStrategy: "auto",
      autoDeployStart: helloWorldTemplate.code
    });
    const deployingFlow = AutoDeployFlow.mock.lastCall?.[0].flow;

    markAutoDeployStart(helloWorldTemplate.code);
    navigate({ templateId: helloWorldTemplate.code, sdlStrategy: "default", bidStrategy: "auto" });

    expect(AutoDeployFlow.mock.lastCall?.[0].flow).toBe(deployingFlow);
  });

  it("auto deploys, on a fresh flow, the template already shown when Deploy again marks it over a manual screen whose create failed", () => {
    const { AutoDeployFlow, ConfigureDeploymentForm, markAutoDeployStart, navigate } = setup({ templateId: helloWorldTemplate.code, flow: { phase: "error" } });
    const failedFlow = ConfigureDeploymentForm.mock.lastCall?.[0].flow;

    markAutoDeployStart(helloWorldTemplate.code);
    navigate({ templateId: helloWorldTemplate.code, sdlStrategy: "default", bidStrategy: "auto" });

    expect(AutoDeployFlow).toHaveBeenLastCalledWith(expect.objectContaining({ sdl: helloWorldTemplate.content }), expect.anything());
    expect(AutoDeployFlow.mock.lastCall?.[0].flow).not.toBe(failedFlow);
  });

  it.each([
    { state: "has a deployment being created", flow: { phase: "creating" } },
    { state: "failed with its deployment still open", flow: { phase: "error", dseq: "1234" } },
    {
      state: "failed while a cancelled deployment is still closing",
      flow: { phase: "error", pendingClose: mock<NonNullable<DeploymentFlow["pendingClose"]>>() }
    },
    { state: "is still closing a cancelled deployment", flow: { pendingClose: mock<NonNullable<DeploymentFlow["pendingClose"]>>() } }
  ] as const)("keeps the form when the shown template is marked over a manual screen that $state", ({ flow }) => {
    const { AutoDeployFlow, markAutoDeployStart, navigate } = setup({ templateId: helloWorldTemplate.code, flow });

    markAutoDeployStart(helloWorldTemplate.code);
    navigate({ templateId: helloWorldTemplate.code, sdlStrategy: "default", bidStrategy: "auto" });

    expect(AutoDeployFlow).not.toHaveBeenCalled();
  });

  it("keeps the form when the shown template is marked after the manual flow began creating a deployment", () => {
    const { AutoDeployFlow, ConfigureDeploymentForm, markAutoDeployStart, navigate } = setup({ templateId: helloWorldTemplate.code });
    const formFlow = ConfigureDeploymentForm.mock.lastCall?.[0].flow as DeploymentFlow;
    formFlow.phase = "creating";
    navigate({ templateId: helloWorldTemplate.code });

    markAutoDeployStart(helloWorldTemplate.code);
    navigate({ templateId: helloWorldTemplate.code, sdlStrategy: "default", bidStrategy: "auto" });

    expect(AutoDeployFlow).not.toHaveBeenCalled();
  });

  it("keeps the form when a deploy button marks another template than the one the URL moves to", () => {
    const { AutoDeployFlow, ConfigureDeploymentForm, markAutoDeployStart, navigate } = setup({
      templateId: "tpl-1",
      template: { isLoading: false, isError: false, data: mock<TemplateOutput>({ deploy: "version: '2.0'" }) }
    });

    markAutoDeployStart("llama");
    navigate({ templateId: helloWorldTemplate.code, sdlStrategy: "default", bidStrategy: "auto" });

    expect(AutoDeployFlow).not.toHaveBeenCalled();
    expect(ConfigureDeploymentForm).toHaveBeenLastCalledWith(
      expect.objectContaining({ intent: expect.objectContaining({ templateId: helloWorldTemplate.code, sdlStrategy: "edit" }) }),
      expect.anything()
    );
  });

  it("hands an auto-deploy intent to the manual form as an edit when its SDL references a secret", () => {
    const { AutoDeployFlow, ConfigureDeploymentForm, DeploymentFlowProvider } = setup({
      templateId: "tpl-1",
      sdlStrategy: "default",
      bidStrategy: "auto",
      autoDeployStart: "tpl-1",
      template: { isLoading: false, isError: false, data: mock<TemplateOutput>({ deploy: SECRET_REFERENCE_SDL }) }
    });

    expect(AutoDeployFlow).not.toHaveBeenCalled();
    expect(DeploymentFlowProvider).toHaveBeenCalledWith(
      expect.objectContaining({ intent: expect.objectContaining({ sdlStrategy: "edit" }) }),
      expect.anything()
    );
    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(
      expect.objectContaining({ initialSdl: SECRET_REFERENCE_SDL, intent: expect.objectContaining({ sdlStrategy: "edit" }) }),
      expect.anything()
    );
  });

  it("keeps an auto-deploy intent on the auto flow when its SDL references no secret", () => {
    const { AutoDeployFlow, ConfigureDeploymentForm } = setup({
      templateId: helloWorldTemplate.code,
      sdlStrategy: "default",
      bidStrategy: "auto",
      autoDeployStart: helloWorldTemplate.code
    });

    expect(ConfigureDeploymentForm).not.toHaveBeenCalled();
    expect(AutoDeployFlow).toHaveBeenCalledWith(expect.objectContaining({ sdl: helloWorldTemplate.content }), expect.anything());
  });

  it("resumes a draft restored under an auto-deploy intent in the manual form as an edit", () => {
    const { AutoDeployFlow, ConfigureDeploymentForm, DeploymentFlowProvider } = setup({
      templateId: "tpl-1",
      sdlStrategy: "default",
      bidStrategy: "auto",
      autoDeployStart: "tpl-1",
      persistedSdl: "restored: sdl"
    });

    expect(AutoDeployFlow).not.toHaveBeenCalled();
    expect(DeploymentFlowProvider).toHaveBeenCalledWith(
      expect.objectContaining({ intent: expect.objectContaining({ sdlStrategy: "edit" }) }),
      expect.anything()
    );
    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(
      expect.objectContaining({ initialSdl: "restored: sdl", intent: expect.objectContaining({ sdlStrategy: "edit" }) }),
      expect.anything()
    );
  });

  it("hands an auto-deploy intent to the manual form once a template that references a secret finishes loading", () => {
    const { ConfigureDeploymentForm, rerenderWithTemplate } = setup({
      templateId: "tpl-1",
      sdlStrategy: "default",
      bidStrategy: "auto",
      autoDeployStart: "tpl-1",
      template: { isLoading: true, isError: false }
    });

    rerenderWithTemplate({ isLoading: false, isError: false, data: mock<TemplateOutput>({ deploy: SECRET_REFERENCE_SDL }) });

    expect(ConfigureDeploymentForm).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialSdl: SECRET_REFERENCE_SDL, intent: expect.objectContaining({ sdlStrategy: "edit" }) }),
      expect.anything()
    );
  });

  it("keeps the manual form once an auto-deploy template has failed, even after the template loads", () => {
    const { AutoDeployFlow, ConfigureDeploymentForm, rerenderWithTemplate } = setup({
      templateId: "tpl-1",
      sdlStrategy: "default",
      bidStrategy: "auto",
      autoDeployStart: "tpl-1",
      template: { isLoading: false, isError: true }
    });

    rerenderWithTemplate({ isLoading: false, isError: false, data: mock<TemplateOutput>({ deploy: "version: '2.0'" }) });

    expect(AutoDeployFlow).not.toHaveBeenCalled();
    expect(ConfigureDeploymentForm).toHaveBeenLastCalledWith(
      expect.objectContaining({ intent: expect.objectContaining({ sdlStrategy: "edit" }) }),
      expect.anything()
    );
  });

  it("keeps the auto flow when a loaded template's background refetch fails", () => {
    const loaded = mock<TemplateOutput>({ deploy: "version: '2.0'" });
    const { AutoDeployFlow, ConfigureDeploymentForm, rerenderWithTemplate } = setup({
      templateId: "tpl-1",
      sdlStrategy: "default",
      bidStrategy: "auto",
      autoDeployStart: "tpl-1",
      template: { isLoading: false, isError: false, data: loaded }
    });

    rerenderWithTemplate({ isLoading: false, isError: true, data: loaded });

    expect(ConfigureDeploymentForm).not.toHaveBeenCalled();
    expect(AutoDeployFlow).toHaveBeenLastCalledWith(expect.objectContaining({ sdl: "version: '2.0'" }), expect.anything());
  });

  it("announces the fallback when a template that was loading fails", () => {
    const { enqueueSnackbar, ConfigureDeploymentForm, rerenderWithTemplate } = setup({ templateId: "tpl-1", template: { isLoading: true, isError: false } });

    rerenderWithTemplate({ isLoading: false, isError: true, data: undefined });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
    expect(ConfigureDeploymentForm).toHaveBeenLastCalledWith(expect.objectContaining({ initialSdl: undefined, initialName: undefined }), expect.anything());
  });

  it("does not announce a fallback when a loaded template's background refetch fails", () => {
    const loaded = mock<TemplateOutput>({ deploy: "version: '2.0'" });
    const { enqueueSnackbar, rerenderWithTemplate } = setup({ templateId: "tpl-1", template: { isLoading: false, isError: false, data: loaded } });

    rerenderWithTemplate({ isLoading: false, isError: true, data: loaded });

    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("hydrates the form from the fetched user template's SDL and title", () => {
    const { ConfigureDeploymentForm, useUserTemplate } = setup({
      userTemplateId: "user-1",
      userTemplate: { isLoading: false, isSuccess: true, data: mock<ITemplate>({ sdl: "user: sdl", title: "My Saved Template" }) }
    });

    expect(useUserTemplate).toHaveBeenCalledWith("user-1");
    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(
      expect.objectContaining({ initialSdl: "user: sdl", initialName: "My Saved Template" }),
      expect.anything()
    );
  });

  it("shows a loading state while the user template is being fetched", () => {
    const { ConfigureDeploymentForm } = setup({ userTemplateId: "user-1", userTemplate: { isLoading: true } });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(ConfigureDeploymentForm).not.toHaveBeenCalled();
  });

  it("surfaces an error and falls back to a default when the user template can't be loaded", () => {
    const { ConfigureDeploymentForm, enqueueSnackbar } = setup({ userTemplateId: "user-1", userTemplate: { isLoading: false, isError: true } });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(expect.objectContaining({ initialSdl: undefined }), expect.anything());
  });

  it("surfaces an error when the user template isn't visible to the viewer", () => {
    const { ConfigureDeploymentForm, enqueueSnackbar } = setup({
      userTemplateId: "user-1",
      userTemplate: { isLoading: false, isSuccess: true, data: null }
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(expect.objectContaining({ initialSdl: undefined }), expect.anything());
  });

  it("restores the draft's persisted SDL and skips the user template fetch", () => {
    const { ConfigureDeploymentForm, useUserTemplate } = setup({ userTemplateId: "user-1", persistedSdl: "restored: sdl" });

    expect(useUserTemplate).toHaveBeenCalledWith(undefined);
    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(expect.objectContaining({ initialSdl: "restored: sdl" }), expect.anything());
  });

  it("forwards the user template id into the form's intent", () => {
    const { ConfigureDeploymentForm } = setup({
      userTemplateId: "user-1",
      userTemplate: { isLoading: false, isSuccess: true, data: mock<ITemplate>({ sdl: "user: sdl" }) }
    });

    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(
      expect.objectContaining({ intent: expect.objectContaining({ userTemplateId: "user-1" }) }),
      expect.anything()
    );
  });

  it("starts the form from the recorded definition when a resume has no draft, template or carried-in SDL", () => {
    const { ConfigureDeploymentForm } = setup({
      templateId: null,
      resume: { activeLeases: [], recordedDefinition: { sdl: "recorded: sdl", name: "recorded-name" } }
    });

    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(
      expect.objectContaining({ initialSdl: "recorded: sdl", initialName: "recorded-name" }),
      expect.anything()
    );
  });

  it("hands the flow a create still running for the resumed deployment", () => {
    const { DeploymentFlowProvider } = setup({ templateId: null, resume: { activeLeases: [], pendingCreate: { activityId: "activity-1" } } });

    expect(DeploymentFlowProvider).toHaveBeenCalledWith(expect.objectContaining({ pendingCreate: { activityId: "activity-1" } }), expect.anything());
  });

  it("prefers the persisted draft over the recorded definition", () => {
    const { ConfigureDeploymentForm } = setup({
      templateId: null,
      persistedSdl: "restored: sdl",
      persistedName: "resumed-name",
      resume: { activeLeases: [], recordedDefinition: { sdl: "recorded: sdl", name: "recorded-name" } }
    });

    expect(ConfigureDeploymentForm).toHaveBeenCalledWith(
      expect.objectContaining({ initialSdl: "restored: sdl", initialName: "resumed-name" }),
      expect.anything()
    );
  });

  function setup(input: {
    templateId?: string | null;
    sdlStrategy?: string;
    bidStrategy?: string;
    draftId?: string;
    isDraftLoading?: boolean;
    persistedSdl?: string;
    persistedName?: string;
    template?: { isLoading?: boolean; isError?: boolean; data?: TemplateOutput };
    userTemplateId?: string;
    userTemplate?: { isLoading?: boolean; isError?: boolean; isSuccess?: boolean; data?: ITemplate | null };
    deploySdl?: TemplateCreation | null;
    vm?: boolean;
    exampleImage?: boolean;
    resume?: ResumeResolution;
    dseq?: string;
    autoDeployStart?: string;
    deployButtonInForm?: string;
    flow?: Partial<DeploymentFlow>;
  }) {
    const store = createStore();
    store.set(sdlStore.deploySdl, input.deploySdl ?? null);
    const wrapper = ({ children }: PropsWithChildren) => <JotaiStoreProvider store={store}>{children}</JotaiStoreProvider>;
    const marker = renderHook(() => useMarkAutoDeployStart(), { wrapper });
    const markAutoDeployStart = (templateId: string) => act(() => marker.result.current(templateId));
    if (input.autoDeployStart) markAutoDeployStart(input.autoDeployStart);

    const DeployButtonInForm = ({ templateId }: { templateId: string }) => {
      const mark = useMarkAutoDeployStart();
      return (
        <button type="button" onClick={() => mark(templateId)}>
          Deploy {templateId}
        </button>
      );
    };
    const ConfigureDeploymentForm = vi.fn<typeof DEPENDENCIES.ConfigureDeploymentForm>(() =>
      input.deployButtonInForm ? <DeployButtonInForm templateId={input.deployButtonInForm} /> : <div data-testid="form-mock" />
    );
    const AutoDeployFlow = vi.fn<typeof DEPENDENCIES.AutoDeployFlow>(() => <div data-testid="auto-mock" />);
    const DeploymentFlowProvider = vi.fn(function FlowProviderMock({ children }) {
      const [flow] = useState(() => mock<DeploymentFlow>({ phase: "configuring", dseq: null, pendingClose: null, ...input.flow }));
      return <>{children({ flow })}</>;
    });
    const enqueueSnackbar = vi.fn();
    let template = input.template;
    const usePublicTemplate = vi.fn(() => mock<ReturnType<typeof DEPENDENCIES.usePublicTemplate>>(template as never));
    const useUserTemplate = vi.fn(() => mock<ReturnType<typeof DEPENDENCIES.useUserTemplate>>(input.userTemplate as never));
    const save = vi.fn();
    const clear = vi.fn();
    let draft = { draftId: input.draftId ?? "minted-id", sdl: input.persistedSdl, name: input.persistedName };
    const useConfigureDraft = vi.fn(() =>
      mock<ReturnType<typeof DEPENDENCIES.useConfigureDraft>>({
        draftId: draft.draftId,
        isLoading: !!input.isDraftLoading,
        persistedSdl: draft.sdl,
        persistedName: draft.name,
        save,
        clear
      })
    );

    const query: Record<string, string> = {};
    if (input.templateId) query.templateId = input.templateId;
    if (input.userTemplateId) query.userTemplateId = input.userTemplateId;
    if (input.sdlStrategy) query["sdl-strategy"] = input.sdlStrategy;
    if (input.bidStrategy) query["bid-strategy"] = input.bidStrategy;
    if (input.vm) query.vm = "true";
    if (input.exampleImage) query.exampleImage = "true";
    let params = new URLSearchParams(query);
    let dseq = input.dseq;

    const DeployTargetGate = vi.fn<typeof DEPENDENCIES.DeployTargetGate>(({ children }) => <>{children}</>);
    const ResumeDeploymentGuard = vi.fn(({ children }) => <>{children(input.resume ?? { activeLeases: [] })}</>);
    const dependencies: typeof DEPENDENCIES = {
      Layout: vi.fn(({ children }) => <div data-testid="layout-mock">{children}</div>) as never,
      NextSeo: vi.fn(() => null) as never,
      AutoDeployFlow: AutoDeployFlow as never,
      ConfigureDeploymentForm: ConfigureDeploymentForm as never,
      DeploymentFlowProvider: DeploymentFlowProvider as never,
      ResumeDeploymentGuard: ResumeDeploymentGuard as never,
      DeployTargetGate,
      usePublicTemplate: usePublicTemplate as never,
      useUserTemplate: useUserTemplate as never,
      useConfigureDraft: useConfigureDraft as never,
      useTakeAutoDeployStart,
      useSearchParams: () => params as unknown as ReadonlyURLSearchParams,
      useParams: (() => (dseq ? { dseq: [dseq] } : {})) as never,
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      Snackbar: vi.fn(() => null) as never
    };

    const renderScreen = () => (
      <JotaiStoreProvider store={store}>
        <ConfigureDeployment dependencies={dependencies} />
      </JotaiStoreProvider>
    );
    const { rerender } = render(renderScreen());
    const rerenderWithTemplate = (next: NonNullable<typeof input.template>) => {
      template = next;
      rerender(renderScreen());
    };
    const navigate = (next: { templateId: string; sdlStrategy?: string; bidStrategy?: string; dseq?: string }) => {
      params = new URLSearchParams({
        templateId: next.templateId,
        ...(next.sdlStrategy ? { "sdl-strategy": next.sdlStrategy } : {}),
        ...(next.bidStrategy ? { "bid-strategy": next.bidStrategy } : {})
      });
      dseq = next.dseq;
      rerender(renderScreen());
    };

    const handOverDraft = (next: { draftId: string; sdl: string; name: string }) => {
      draft = next;
      params = new URLSearchParams({ draftId: next.draftId });
      rerender(renderScreen());
    };

    return {
      ConfigureDeploymentForm,
      AutoDeployFlow,
      DeploymentFlowProvider,
      usePublicTemplate,
      useUserTemplate,
      useConfigureDraft,
      ResumeDeploymentGuard,
      DeployTargetGate,
      enqueueSnackbar,
      rerenderWithTemplate,
      markAutoDeployStart,
      navigate,
      handOverDraft
    };
  }
});
