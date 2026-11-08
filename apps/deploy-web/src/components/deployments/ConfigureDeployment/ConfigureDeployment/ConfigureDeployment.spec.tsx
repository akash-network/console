import type { PropsWithChildren, ReactNode } from "react";
import { useEffect, useState } from "react";
import type { TemplateOutput } from "@akashnetwork/http-sdk";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { createStore, Provider as JotaiStoreProvider } from "jotai";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useMarkAutoDeployStart, useTakeAutoDeployStart } from "@src/hooks/useAutoDeployStart/useAutoDeployStart";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import sdlStore from "@src/store/sdlStore";
import type { ITemplate, TemplateCreation } from "@src/types";
import type { MarketplaceTemplate, TemplateAskedValue, TemplateVersionDetail } from "@src/types/marketplace-template";
import { helloWorldTemplate } from "@src/utils/templates";
import type { DEPENDENCIES as GUARD_DEPENDENCIES, ResumeResolution } from "../ResumeDeploymentGuard/ResumeDeploymentGuard";
import { ResumeDeploymentGuard as RealResumeDeploymentGuard } from "../ResumeDeploymentGuard/ResumeDeploymentGuard";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./ConfigureDeployment";
import { ConfigureDeployment } from "./ConfigureDeployment";

import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";
import { buildMarketplaceTemplate, buildTemplateVersion } from "@tests/seeders/userTemplate";

const ASSISTANT_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx:alpine\n';

const ASKED_MODEL: TemplateAskedValue = {
  key: "MODEL",
  label: "Model",
  type: "text",
  default: "gpt-4o-mini",
  required: false,
  bindings: [{ service: "web", env: "MODEL" }]
};

const NO_QUERY = { isLoading: false, isError: false, isSuccess: false, data: undefined };

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

  describe("when a deployment is opened onto the screen already showing", () => {
    it("starts the form from the handed-over draft and follows the deployment's create", () => {
      const create = buildActivity({ type: "deployment_create", status: "pending", meta: { dseq: "123" } });
      const { ConfigureDeploymentForm, DeploymentFlowProvider, openUrl } = setup({
        templateId: null,
        draftId: "open-draft",
        drafts: { "open-draft": { sdl: "open: sdl" }, "assistant-draft": { sdl: ASSISTANT_SDL, name: "web" } },
        chain: { deployments: { "123": deploymentNotFound() }, activities: [create] }
      });

      openUrl({ dseq: "123", draftId: "assistant-draft" });

      expect(ConfigureDeploymentForm).toHaveBeenLastCalledWith(expect.objectContaining({ initialSdl: ASSISTANT_SDL, initialName: "web" }), expect.anything());
      expect(DeploymentFlowProvider).toHaveBeenLastCalledWith(expect.objectContaining({ pendingCreate: { activityId: create.id } }), expect.anything());
    });

    it("starts the form from the definition the console recorded when the link carries no draft", () => {
      const { ConfigureDeploymentForm, openUrl } = setup({
        templateId: null,
        draftId: "open-draft",
        drafts: { "open-draft": { sdl: "open: sdl" } },
        chain: { deployments: { "123": deploymentRecordedWith(ASSISTANT_SDL) }, activities: [] }
      });

      openUrl({ dseq: "123" });

      expect(ConfigureDeploymentForm).toHaveBeenLastCalledWith(expect.objectContaining({ initialSdl: ASSISTANT_SDL }), expect.anything());
    });

    it("keeps the screen when the URL takes the draft id the screen minted", () => {
      const { countGuardMounts, openUrl } = setup({ templateId: null, drafts: {}, chain: { deployments: {}, activities: [] } });

      openUrl({ draftId: "minted-id" });

      expect(countGuardMounts()).toBe(1);
    });

    it("keeps the screen when an unreadable draft continues under a minted id", () => {
      const { countGuardMounts, failDraftRead, openUrl } = setup({
        templateId: null,
        draftId: "unreadable-draft",
        drafts: {},
        chain: { deployments: {}, activities: [] }
      });

      failDraftRead();
      openUrl({ draftId: "minted-id" });

      expect(countGuardMounts()).toBe(1);
    });

    it("starts the screen over when a link without a draft opens a fresh deployment", () => {
      const { countGuardMounts, openUrl } = setup({
        templateId: null,
        draftId: "open-draft",
        drafts: { "open-draft": { sdl: "open: sdl" } },
        chain: { deployments: {}, activities: [] }
      });

      openUrl({});

      expect(countGuardMounts()).toBe(2);
    });

    it("keeps the screen when the flow writes the deployment it created into the URL", () => {
      const { countGuardMounts, openUrl } = setup({
        templateId: null,
        draftId: "open-draft",
        drafts: { "open-draft": { sdl: "open: sdl" } },
        chain: { deployments: {}, activities: [] }
      });

      openUrl({ dseq: "123", draftId: "open-draft" });

      expect(countGuardMounts()).toBe(1);
    });

    it("keeps a fresh template session while it writes its minted draft id and then its deployment into the URL", () => {
      const { ConfigureDeploymentForm, countGuardMounts, writeOwnDseq } = setup({
        templateId: helloWorldTemplate.code,
        drafts: {},
        writesMintedDraftIdToUrl: true,
        chain: { deployments: {}, activities: [] }
      });

      writeOwnDseq("123");

      expect(countGuardMounts()).toBe(1);
      expect(ConfigureDeploymentForm).toHaveBeenLastCalledWith(
        expect.objectContaining({ initialSdl: helloWorldTemplate.content, intent: expect.objectContaining({ draftId: "minted-id", dseq: "123" }) }),
        expect.anything()
      );
    });

    it("keeps a fresh session started from scratch while it writes its minted draft id and then its deployment into the URL", () => {
      const { countGuardMounts, writeOwnDseq, currentUrl } = setup({
        templateId: null,
        drafts: {},
        writesMintedDraftIdToUrl: true,
        chain: { deployments: {}, activities: [] }
      });

      writeOwnDseq("123");

      expect(currentUrl()).toEqual({ dseq: "123", draftId: "minted-id" });
      expect(countGuardMounts()).toBe(1);
    });

    it("resumes the draft and deployment a reloaded URL names without starting over", () => {
      const { ConfigureDeploymentForm, countGuardMounts } = setup({
        templateId: null,
        dseq: "123",
        draftId: "open-draft",
        drafts: { "open-draft": { sdl: "open: sdl" } },
        writesMintedDraftIdToUrl: true,
        chain: { deployments: { "123": deploymentRecordedWith(ASSISTANT_SDL) }, activities: [] }
      });

      expect(countGuardMounts()).toBe(1);
      expect(ConfigureDeploymentForm).toHaveBeenLastCalledWith(
        expect.objectContaining({ initialSdl: "open: sdl", intent: expect.objectContaining({ draftId: "open-draft", dseq: "123" }) }),
        expect.anything()
      );
    });

    it("starts over once from the recorded definition when a link without a draft opens the deployment on screen", () => {
      const { ConfigureDeploymentForm, countGuardMounts, openUrl, currentUrl } = setup({
        templateId: null,
        dseq: "123",
        draftId: "open-draft",
        drafts: { "open-draft": { sdl: "open: sdl" } },
        writesMintedDraftIdToUrl: true,
        chain: { deployments: { "123": deploymentRecordedWith(ASSISTANT_SDL) }, activities: [] }
      });

      openUrl({ dseq: "123" });

      expect(currentUrl()).toEqual({ dseq: "123", draftId: "minted-id" });
      expect(countGuardMounts()).toBe(2);
      expect(ConfigureDeploymentForm).toHaveBeenLastCalledWith(expect.objectContaining({ initialSdl: ASSISTANT_SDL }), expect.anything());
    });

    it("starts the screen over for each draft when navigating back and forth between two", () => {
      const { ConfigureDeploymentForm, countGuardMounts, openUrl } = setup({
        templateId: null,
        draftId: "first-draft",
        drafts: { "first-draft": { sdl: "first: sdl" }, "second-draft": { sdl: "second: sdl" } },
        chain: { deployments: {}, activities: [] }
      });

      openUrl({ draftId: "second-draft" });
      expect(ConfigureDeploymentForm).toHaveBeenLastCalledWith(expect.objectContaining({ initialSdl: "second: sdl" }), expect.anything());

      openUrl({ draftId: "first-draft" });

      expect(countGuardMounts()).toBe(3);
      expect(ConfigureDeploymentForm).toHaveBeenLastCalledWith(
        expect.objectContaining({ initialSdl: "first: sdl", intent: expect.objectContaining({ draftId: "first-draft" }) }),
        expect.anything()
      );
    });
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

  describe("in template mode", () => {
    it("opens template mode only with template_marketplace on", () => {
      const enabled = setup({ templateMode: "new", draftId: "imported", persistedSdl: ASSISTANT_SDL, isTemplateMarketplaceEnabled: true });

      expect(enabled.ConfigureTemplateForm).toHaveBeenCalled();
      expect(enabled.ConfigureTemplateForm.mock.lastCall?.[0]).toMatchObject({ initialSdl: ASSISTANT_SDL, askedValues: [], template: undefined });
      expect(enabled.ConfigureTemplateForm.mock.lastCall?.[0].intent).toMatchObject({ templateMode: "new", draftId: "imported" });
      expect(enabled.ConfigureDeploymentForm).not.toHaveBeenCalled();
    });

    it("opens the deploy form exactly as before with template_marketplace off", () => {
      const { ConfigureTemplateForm, ConfigureDeploymentForm, useMarketplaceTemplate, useUserTemplate } = setup({
        templateMode: "edit",
        userTemplateId: "tpl-9",
        userTemplate: { isLoading: false, isError: false, isSuccess: true, data: mock<ITemplate>({ sdl: ASSISTANT_SDL, title: "Mine" }) }
      });

      expect(ConfigureTemplateForm).not.toHaveBeenCalled();
      expect(useMarketplaceTemplate).not.toHaveBeenCalled();
      expect(useUserTemplate).toHaveBeenLastCalledWith("tpl-9");
      const { intent } = ConfigureDeploymentForm.mock.lastCall?.[0] ?? {};
      expect(intent?.templateMode).toBeUndefined();
      expect(intent?.userTemplateId).toBe("tpl-9");
    });

    it("drops the copy from the deploy form's intent with template_marketplace off", () => {
      const { useConfigureDraft } = setup({ templateMode: "new", copyFromTemplateId: "tpl-1", copyFromVersion: 2 });

      const [intent] = useConfigureDraft.mock.lastCall ?? [];
      expect(intent).not.toHaveProperty("templateMode");
      expect(intent).not.toHaveProperty("copyFromTemplateId");
      expect(intent).not.toHaveProperty("copyFromVersion");
    });

    it("mounts no deploy flow, resume guard or deploy form in template mode", () => {
      const editing = setup({ templateMode: "edit", userTemplateId: "tpl-9", isTemplateMarketplaceEnabled: true, marketplaceTemplate: editableTemplate() });

      expect(editing.ConfigureTemplateForm).toHaveBeenCalled();
      expect(editing.DeploymentFlowProvider).not.toHaveBeenCalled();
      expect(editing.ResumeDeploymentGuard).not.toHaveBeenCalled();
      expect(editing.AutoDeployFlow).not.toHaveBeenCalled();
      expect(editing.ConfigureDeploymentForm).not.toHaveBeenCalled();
    });

    it("skips the project gate in edit mode", () => {
      const { DeployTargetGate } = setup({
        templateMode: "edit",
        userTemplateId: "tpl-9",
        isTemplateMarketplaceEnabled: true,
        marketplaceTemplate: editableTemplate()
      });

      expect(DeployTargetGate).not.toHaveBeenCalled();
    });

    it("parses a template mode URL as before with template_marketplace off", () => {
      const { ConfigureDeploymentForm, ConfigureTemplateForm, usePublicTemplate } = setup({
        templateMode: "new",
        templateId: "abc",
        sdlStrategy: "default",
        template: { isLoading: false, isError: false, data: mock<TemplateOutput>({ deploy: ASSISTANT_SDL, name: "abc" }) }
      });

      expect(ConfigureTemplateForm).not.toHaveBeenCalled();
      expect(usePublicTemplate).toHaveBeenLastCalledWith("abc");
      expect(ConfigureDeploymentForm.mock.lastCall?.[0].intent).toMatchObject({ templateId: "abc", draftId: "minted-id" });
      expect(ConfigureDeploymentForm.mock.lastCall?.[0].intent).not.toHaveProperty("templateMode");
    });

    it("pins the version an edit starts from in the URL", () => {
      const { ConfigureTemplateForm, router } = setup({
        templateMode: "edit",
        userTemplateId: "tpl-9",
        isTemplateMarketplaceEnabled: true,
        marketplaceTemplate: editableTemplate()
      });

      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith(
        "/new-deployment/configure?templateMode=edit&userTemplateId=tpl-9&draftId=minted-id&baseVersion=4",
        undefined,
        {
          shallow: true
        }
      );
      expect(ConfigureTemplateForm.mock.lastCall?.[0].intent).toMatchObject({ baseVersion: 4 });
    });

    it("re-pins a reload without a draft to the current version it starts from", () => {
      const { ConfigureTemplateForm, router } = setup({
        templateMode: "edit",
        userTemplateId: "tpl-9",
        baseVersion: 3,
        isTemplateMarketplaceEnabled: true,
        marketplaceTemplate: editableTemplate()
      });

      expect(ConfigureTemplateForm.mock.lastCall?.[0]).toMatchObject({ initialSdl: ASSISTANT_SDL, intent: expect.objectContaining({ baseVersion: 4 }) });
      expect(router.replace).toHaveBeenCalledWith(
        "/new-deployment/configure?templateMode=edit&userTemplateId=tpl-9&draftId=minted-id&baseVersion=4",
        undefined,
        {
          shallow: true
        }
      );
    });

    it("keeps the URL's base version for a restored draft built on it", () => {
      const { ConfigureTemplateForm, router } = setup({
        templateMode: "edit",
        userTemplateId: "tpl-9",
        baseVersion: 3,
        persistedSdl: "restored: sdl",
        isTemplateMarketplaceEnabled: true,
        marketplaceTemplate: editableTemplate()
      });

      expect(ConfigureTemplateForm.mock.lastCall?.[0]).toMatchObject({ initialSdl: "restored: sdl", intent: expect.objectContaining({ baseVersion: 3 }) });
      expect(router.replace).not.toHaveBeenCalled();
    });

    it("pins a restored draft from before pinning to the current version", () => {
      const { ConfigureTemplateForm } = setup({
        templateMode: "edit",
        userTemplateId: "tpl-9",
        persistedSdl: "restored: sdl",
        isTemplateMarketplaceEnabled: true,
        marketplaceTemplate: editableTemplate()
      });

      expect(ConfigureTemplateForm.mock.lastCall?.[0].intent).toMatchObject({ baseVersion: 4 });
    });

    it("waits for the draft before pinning the base version", () => {
      const { ConfigureTemplateForm, router } = setup({
        templateMode: "edit",
        userTemplateId: "tpl-9",
        baseVersion: 3,
        isDraftLoading: true,
        isTemplateMarketplaceEnabled: true,
        marketplaceTemplate: editableTemplate()
      });

      expect(ConfigureTemplateForm).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    });

    it("keeps the pinned base version and the mounted form when a newer version arrives mid-edit", () => {
      const { ConfigureTemplateForm, rerenderWithMarketplaceTemplate, countTemplateFormMounts } = setup({
        templateMode: "edit",
        userTemplateId: "tpl-9",
        isTemplateMarketplaceEnabled: true,
        marketplaceTemplate: editableTemplate()
      });

      rerenderWithMarketplaceTemplate(editableTemplate(5));

      expect(ConfigureTemplateForm.mock.lastCall?.[0].template?.currentVersion?.version).toBe(5);
      expect(ConfigureTemplateForm.mock.lastCall?.[0].intent).toMatchObject({ baseVersion: 4 });
      expect(countTemplateFormMounts()).toBe(1);
    });

    it("names the deployment a new template is saved from", () => {
      const { ConfigureTemplateForm } = setup({ templateMode: "new", sourceDseq: "1234", isTemplateMarketplaceEnabled: true });

      expect(ConfigureTemplateForm.mock.lastCall?.[0].intent).toMatchObject({ sourceDseq: "1234" });
    });

    it("never requests bids for a new template, holding it behind the project gate", () => {
      const { ConfigureTemplateForm, DeploymentFlowProvider, ResumeDeploymentGuard, DeployTargetGate } = setup({
        templateMode: "new",
        isTemplateMarketplaceEnabled: true
      });

      expect(DeployTargetGate).toHaveBeenCalled();
      expect(DeployTargetGate.mock.lastCall?.[0].filedDseq).toBeUndefined();
      expect(ConfigureTemplateForm).toHaveBeenCalled();
      expect(DeploymentFlowProvider).not.toHaveBeenCalled();
      expect(ResumeDeploymentGuard).not.toHaveBeenCalled();
    });

    it("sends a non-editor from edit mode to the template page", () => {
      const { ConfigureTemplateForm, router } = setup({
        templateMode: "edit",
        userTemplateId: "tpl-9",
        isTemplateMarketplaceEnabled: true,
        marketplaceTemplate: { isSuccess: true, data: buildMarketplaceTemplate({ id: "tpl-9", canEdit: false }) }
      });

      expect(router.replace).toHaveBeenCalledWith("/template/tpl-9");
      expect(ConfigureTemplateForm).not.toHaveBeenCalled();
    });

    it("edits the template's current version with its asked values", () => {
      const { ConfigureTemplateForm, useMarketplaceTemplate, router } = setup({
        templateMode: "edit",
        userTemplateId: "tpl-9",
        isTemplateMarketplaceEnabled: true,
        marketplaceTemplate: editableTemplate()
      });

      expect(useMarketplaceTemplate).toHaveBeenLastCalledWith("tpl-9");
      expect(router.replace).not.toHaveBeenCalledWith("/template/tpl-9");
      const props = ConfigureTemplateForm.mock.lastCall?.[0];
      expect(props).toMatchObject({ initialSdl: ASSISTANT_SDL, initialName: "Support chat", askedValues: [ASKED_MODEL] });
      expect(props?.template?.id).toBe("tpl-9");
      expect(props?.intent).toMatchObject({ templateMode: "edit", userTemplateId: "tpl-9", draftId: "minted-id" });
    });

    it("prefers the draft's SDL and name while keeping the template's asked values", () => {
      const { ConfigureTemplateForm } = setup({
        templateMode: "edit",
        userTemplateId: "tpl-9",
        persistedSdl: "restored: sdl",
        persistedName: "draft-name",
        isTemplateMarketplaceEnabled: true,
        marketplaceTemplate: editableTemplate()
      });

      expect(ConfigureTemplateForm.mock.lastCall?.[0]).toMatchObject({ initialSdl: "restored: sdl", initialName: "draft-name", askedValues: [ASKED_MODEL] });
    });

    it("waits for the template before opening the editor", () => {
      const { ConfigureTemplateForm } = setup({
        templateMode: "edit",
        userTemplateId: "tpl-9",
        isTemplateMarketplaceEnabled: true,
        marketplaceTemplate: { isLoading: true }
      });

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(ConfigureTemplateForm).not.toHaveBeenCalled();
    });

    it("waits for a resumed draft before reading a copy", () => {
      const { ConfigureTemplateForm, useTemplateVersion } = setup({
        templateMode: "new",
        copyFromTemplateId: "tpl-1",
        copyFromVersion: 2,
        isDraftLoading: true,
        isTemplateMarketplaceEnabled: true
      });

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(ConfigureTemplateForm).not.toHaveBeenCalled();
      expect(useTemplateVersion).toHaveBeenLastCalledWith(undefined, undefined);
    });

    it("sends an unreadable template back to My templates", () => {
      const { ConfigureTemplateForm, router, enqueueSnackbar } = setup({
        templateMode: "edit",
        userTemplateId: "tpl-9",
        isTemplateMarketplaceEnabled: true,
        marketplaceTemplate: { isError: true }
      });

      expect(router.replace).toHaveBeenCalledWith("/templates/mine");
      expect(enqueueSnackbar.mock.lastCall?.[0].props).toMatchObject({ title: "Couldn't load the template" });
      expect(enqueueSnackbar.mock.lastCall?.[1]).toEqual({ variant: "error" });
      expect(ConfigureTemplateForm).not.toHaveBeenCalled();
    });

    it("starts a copy from the copied version", () => {
      const { ConfigureTemplateForm, useTemplateVersion, enqueueSnackbar } = setup({
        templateMode: "new",
        copyFromTemplateId: "tpl-1",
        copyFromVersion: 2,
        isTemplateMarketplaceEnabled: true,
        templateVersion: { isSuccess: true, data: buildTemplateVersion({ templateId: "tpl-1", version: 2, sdl: ASSISTANT_SDL, askedValues: [ASKED_MODEL] }) }
      });

      expect(useTemplateVersion).toHaveBeenLastCalledWith("tpl-1", 2);
      expect(enqueueSnackbar).not.toHaveBeenCalled();
      const props = ConfigureTemplateForm.mock.lastCall?.[0];
      expect(props).toMatchObject({ initialSdl: ASSISTANT_SDL, askedValues: [ASKED_MODEL], template: undefined });
      expect(props?.intent).toMatchObject({ templateMode: "new", copyFromTemplateId: "tpl-1", copyFromVersion: 2 });
    });

    it("waits for the copied version before opening the editor", () => {
      const { ConfigureTemplateForm } = setup({
        templateMode: "new",
        copyFromTemplateId: "tpl-1",
        copyFromVersion: 2,
        isTemplateMarketplaceEnabled: true,
        templateVersion: { isLoading: true }
      });

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(ConfigureTemplateForm).not.toHaveBeenCalled();
    });

    it("starts a new template without the copy when the copied version cannot be read", () => {
      const { ConfigureTemplateForm, enqueueSnackbar } = setup({
        templateMode: "new",
        copyFromTemplateId: "tpl-1",
        copyFromVersion: 2,
        isTemplateMarketplaceEnabled: true,
        templateVersion: { isError: true }
      });

      expect(enqueueSnackbar.mock.lastCall?.[0].props).toMatchObject({
        title: "Couldn't load the template",
        subTitle: "Starting from a new template instead."
      });
      expect(enqueueSnackbar.mock.lastCall?.[1]).toEqual({ variant: "error" });
      const props = ConfigureTemplateForm.mock.lastCall?.[0];
      expect(props?.initialSdl).toBeUndefined();
      expect(props?.intent).not.toHaveProperty("copyFromTemplateId");
    });

    it("keeps a restored copy's origin without reading the copied version again", () => {
      const { ConfigureTemplateForm, useTemplateVersion } = setup({
        templateMode: "new",
        copyFromTemplateId: "tpl-1",
        copyFromVersion: 2,
        persistedSdl: "restored: sdl",
        isTemplateMarketplaceEnabled: true
      });

      expect(useTemplateVersion).toHaveBeenLastCalledWith(undefined, undefined);
      const props = ConfigureTemplateForm.mock.lastCall?.[0];
      expect(props).toMatchObject({ initialSdl: "restored: sdl", askedValues: [] });
      expect(props?.intent).toMatchObject({ copyFromTemplateId: "tpl-1", copyFromVersion: 2 });
    });

    it("keeps a copy on the copied version once its draft is saved and then cleared", () => {
      const { useTemplateVersion, ConfigureTemplateForm, countTemplateFormMounts, changePersistedSdl } = setup({
        templateMode: "new",
        copyFromTemplateId: "tpl-1",
        copyFromVersion: 2,
        isTemplateMarketplaceEnabled: true,
        templateVersion: { isSuccess: true, data: buildTemplateVersion({ templateId: "tpl-1", version: 2, sdl: ASSISTANT_SDL, askedValues: [ASKED_MODEL] }) }
      });

      changePersistedSdl("saved: sdl");
      changePersistedSdl(undefined);

      expect(useTemplateVersion.mock.calls.filter(call => JSON.stringify(call) !== JSON.stringify(["tpl-1", 2]))).toEqual([]);
      expect(countTemplateFormMounts()).toBe(1);
      expect(ConfigureTemplateForm.mock.lastCall?.[0].intent).toMatchObject({ copyFromTemplateId: "tpl-1", copyFromVersion: 2 });
    });

    it("never reads the copied version for a restored copy once its draft is cleared", () => {
      const { useTemplateVersion, changePersistedSdl } = setup({
        templateMode: "new",
        copyFromTemplateId: "tpl-1",
        copyFromVersion: 2,
        persistedSdl: "restored: sdl",
        isTemplateMarketplaceEnabled: true
      });

      changePersistedSdl(undefined);

      expect(useTemplateVersion).not.toHaveBeenCalledWith("tpl-1", 2);
    });

    it("hands the title and summary suggested for the template to the form", () => {
      const { ConfigureTemplateForm } = setup({
        templateMode: "new",
        persistedSdl: "assistant: sdl",
        persistedTemplateTitle: "Support chat",
        persistedTemplateSummary: "Chat through one key.",
        isTemplateMarketplaceEnabled: true
      });

      expect(ConfigureTemplateForm.mock.lastCall?.[0]).toMatchObject({ suggestedTitle: "Support chat", suggestedSummary: "Chat through one key." });
    });

    it("starts the screen over when the URL names another draft", () => {
      const { ConfigureTemplateForm, openUrl } = setup({
        templateMode: "new",
        draftId: "first-draft",
        drafts: { "first-draft": { sdl: "first: sdl" }, "second-draft": { sdl: "second: sdl" } },
        isTemplateMarketplaceEnabled: true
      });

      openUrl({ draftId: "second-draft", templateMode: "new" });

      expect(ConfigureTemplateForm.mock.lastCall?.[0]).toMatchObject({
        initialSdl: "second: sdl",
        intent: expect.objectContaining({ draftId: "second-draft" })
      });
    });
  });

  function editableTemplate(version = 4) {
    return {
      isSuccess: true,
      data: buildMarketplaceTemplate({
        id: "tpl-9",
        title: "Support chat",
        canEdit: true,
        currentVersion: buildTemplateVersion({ templateId: "tpl-9", version, sdl: ASSISTANT_SDL, askedValues: [ASKED_MODEL] })
      })
    };
  }

  function setup(input: {
    templateId?: string | null;
    sdlStrategy?: string;
    bidStrategy?: string;
    draftId?: string;
    isDraftLoading?: boolean;
    persistedSdl?: string;
    persistedName?: string;
    persistedTemplateTitle?: string;
    persistedTemplateSummary?: string;
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
    drafts?: Record<string, { sdl: string; name?: string }>;
    chain?: { deployments: Record<string, ChainDeploymentRead>; activities: Activity[] };
    writesMintedDraftIdToUrl?: boolean;
    templateMode?: "new" | "edit";
    copyFromTemplateId?: string;
    copyFromVersion?: number;
    isTemplateMarketplaceEnabled?: boolean;
    marketplaceTemplate?: { isLoading?: boolean; isError?: boolean; isSuccess?: boolean; data?: MarketplaceTemplate };
    templateVersion?: { isLoading?: boolean; isError?: boolean; isSuccess?: boolean; data?: TemplateVersionDetail };
    baseVersion?: number;
    sourceDseq?: string;
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
    let templateFormMounts = 0;
    const ConfigureTemplateForm = vi.fn<typeof DEPENDENCIES.ConfigureTemplateForm>(function TemplateFormMock() {
      useEffect(function countMount() {
        templateFormMounts++;
      }, []);
      return <div data-testid="template-form-mock" />;
    });
    let marketplaceTemplate = input.marketplaceTemplate;
    const useMarketplaceTemplate = vi.fn(() => ({ ...NO_QUERY, ...marketplaceTemplate }) as never);
    const useTemplateVersion = vi.fn(() => ({ ...NO_QUERY, ...input.templateVersion }) as never);
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
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
    let isDraftReadFailed = false;
    let writeUrl = (_next: { params: URLSearchParams; dseq?: string }) => {};
    const useConfigureDraft = vi.fn(function useConfigureDraftFake(intent: DeploymentIntent) {
      const current = input.drafts ? draftFollowingTheUrl(input.drafts, intent, isDraftReadFailed) : draft;
      useEffect(
        function writeMintedDraftIdIntoUrl() {
          if (!input.writesMintedDraftIdToUrl || intent.draftId === current.draftId) return;
          writeUrl({ params: new URLSearchParams({ ...Object.fromEntries(params), draftId: current.draftId }), dseq: intent.dseq });
        },
        [intent.draftId, intent.dseq, current.draftId]
      );
      return mock<ReturnType<typeof DEPENDENCIES.useConfigureDraft>>({
        draftId: current.draftId,
        isLoading: !!input.isDraftLoading,
        persistedSdl: current.sdl,
        persistedName: current.name,
        persistedTemplateTitle: input.persistedTemplateTitle,
        persistedTemplateSummary: input.persistedTemplateSummary,
        save,
        clear
      });
    });

    const query: Record<string, string> = {};
    if (input.templateId) query.templateId = input.templateId;
    if (input.userTemplateId) query.userTemplateId = input.userTemplateId;
    if (input.sdlStrategy) query["sdl-strategy"] = input.sdlStrategy;
    if (input.bidStrategy) query["bid-strategy"] = input.bidStrategy;
    if (input.vm) query.vm = "true";
    if (input.exampleImage) query.exampleImage = "true";
    if (input.drafts && input.draftId) query.draftId = input.draftId;
    if (input.templateMode) query.templateMode = input.templateMode;
    if (input.templateMode && input.draftId) query.draftId = input.draftId;
    if (input.copyFromTemplateId) query.copyFromTemplateId = input.copyFromTemplateId;
    if (input.copyFromVersion) query.copyFromVersion = String(input.copyFromVersion);
    if (input.baseVersion) query.baseVersion = String(input.baseVersion);
    if (input.sourceDseq) query.sourceDseq = input.sourceDseq;
    let params = new URLSearchParams(query);
    let dseq = input.dseq;

    const DeployTargetGate = vi.fn<typeof DEPENDENCIES.DeployTargetGate>(({ children }) => <>{children}</>);
    let guardMounts = 0;
    const GuardMountCounter = () => {
      useEffect(function countMount() {
        guardMounts++;
      }, []);
      return null;
    };
    const chain = input.chain;
    const ResumeDeploymentGuard = vi.fn(({ children, ...props }) =>
      chain ? (
        <>
          <GuardMountCounter />
          <RealResumeDeploymentGuard {...props} dependencies={guardDependenciesReading(chain)}>
            {children}
          </RealResumeDeploymentGuard>
        </>
      ) : (
        <>{children(input.resume ?? { activeLeases: [] })}</>
      )
    );
    const dependencies: typeof DEPENDENCIES = {
      Layout: vi.fn(({ children }) => <div data-testid="layout-mock">{children}</div>) as never,
      NextSeo: vi.fn(() => null) as never,
      AutoDeployFlow: AutoDeployFlow as never,
      ConfigureDeploymentForm: ConfigureDeploymentForm as never,
      ConfigureTemplateForm: ConfigureTemplateForm as never,
      DeploymentFlowProvider: DeploymentFlowProvider as never,
      ResumeDeploymentGuard: ResumeDeploymentGuard as never,
      DeployTargetGate,
      usePublicTemplate: usePublicTemplate as never,
      useUserTemplate: useUserTemplate as never,
      useMarketplaceTemplate: useMarketplaceTemplate as never,
      useTemplateVersion: useTemplateVersion as never,
      useFlag: flag => flag === "template_marketplace" && !!input.isTemplateMarketplaceEnabled,
      useRouter: () => router,
      useConfigureDraft: useConfigureDraft as never,
      useTakeAutoDeployStart,
      useSearchParams: () => params as unknown as ReadonlyURLSearchParams,
      useParams: (() => (dseq ? { dseq: [dseq] } : {})) as never,
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      Snackbar: vi.fn(() => null) as never
    };

    const UrlHost = () => {
      const [, setUrlVersion] = useState(0);
      writeUrl = next => {
        params = next.params;
        dseq = next.dseq;
        setUrlVersion(version => version + 1);
      };
      return <ConfigureDeployment dependencies={dependencies} />;
    };
    const renderScreen = () => (
      <JotaiStoreProvider store={store}>
        <UrlHost />
      </JotaiStoreProvider>
    );
    const { rerender } = render(renderScreen());
    const rerenderWithTemplate = (next: NonNullable<typeof input.template>) => {
      template = next;
      rerender(renderScreen());
    };
    const rerenderWithMarketplaceTemplate = (next: NonNullable<typeof input.marketplaceTemplate>) => {
      marketplaceTemplate = next;
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

    const changePersistedSdl = (sdl: string | undefined) => {
      draft = { ...draft, sdl };
      rerender(renderScreen());
    };

    const failDraftRead = () => {
      isDraftReadFailed = true;
      rerender(renderScreen());
    };

    const openUrl = (next: { dseq?: string; draftId?: string; templateMode?: string }) => {
      params = new URLSearchParams({ ...(next.draftId ? { draftId: next.draftId } : {}), ...(next.templateMode ? { templateMode: next.templateMode } : {}) });
      dseq = next.dseq;
      rerender(renderScreen());
    };

    const writeOwnDseq = (createdDseq: string) => {
      dseq = createdDseq;
      rerender(renderScreen());
    };

    const handOverDraft = (next: { draftId: string; sdl: string; name: string }) => {
      draft = next;
      params = new URLSearchParams({ draftId: next.draftId });
      rerender(renderScreen());
    };

    return {
      ConfigureDeploymentForm,
      ConfigureTemplateForm,
      useMarketplaceTemplate,
      useTemplateVersion,
      router,
      AutoDeployFlow,
      DeploymentFlowProvider,
      usePublicTemplate,
      useUserTemplate,
      useConfigureDraft,
      ResumeDeploymentGuard,
      DeployTargetGate,
      enqueueSnackbar,
      rerenderWithTemplate,
      rerenderWithMarketplaceTemplate,
      countTemplateFormMounts: () => templateFormMounts,
      markAutoDeployStart,
      navigate,
      openUrl,
      writeOwnDseq,
      currentUrl: () => ({ dseq, ...Object.fromEntries(params) }),
      failDraftRead,
      changePersistedSdl,
      handOverDraft,
      countGuardMounts: () => guardMounts
    };
  }

  function draftFollowingTheUrl(drafts: Record<string, { sdl: string; name?: string }>, intent: DeploymentIntent, isDraftReadFailed: boolean) {
    const draftId = intent.draftId && !isDraftReadFailed ? intent.draftId : "minted-id";
    return { draftId, sdl: drafts[draftId]?.sdl, name: drafts[draftId]?.name };
  }

  function guardDependenciesReading(chain: NonNullable<Parameters<typeof setup>[0]["chain"]>): typeof GUARD_DEPENDENCIES {
    return {
      Layout: vi.fn(({ children }: { children: ReactNode }) => <div data-testid="layout-mock">{children}</div>) as never,
      useRouter: (() => mock<ReturnType<typeof GUARD_DEPENDENCIES.useRouter>>()) as never,
      useSnackbar: () => mock<ReturnType<typeof GUARD_DEPENDENCIES.useSnackbar>>(),
      Snackbar: vi.fn(() => null) as never,
      useGetDeployment: ((dseq: string | undefined) => (dseq ? chain.deployments[dseq] : undefined) ?? { isLoading: false, isError: false }) as never,
      useActivityFeedQuery: () =>
        Object.assign(mock<ReturnType<typeof GUARD_DEPENDENCIES.useActivityFeedQuery>>(), {
          data: { activities: chain.activities, unseenCount: 0, newestCreatedAt: chain.activities[0]?.createdAt },
          isError: false
        })
    };
  }

  function deploymentNotFound(): ChainDeploymentRead {
    return { isLoading: false, isError: true, error: new ApiError(404, { message: "Deployment not found" }, "GET → 404") };
  }

  function deploymentRecordedWith(sdl: string): ChainDeploymentRead {
    return {
      isLoading: false,
      isError: false,
      data: { data: { deployment: { state: "active", hash: "v1" }, leases: [], name: null, consoleSettings: { sdl, manifestVersion: "v1" } } }
    };
  }
});

type ChainDeploymentRead = { isLoading: boolean; isError: boolean; error?: unknown; data?: unknown };
