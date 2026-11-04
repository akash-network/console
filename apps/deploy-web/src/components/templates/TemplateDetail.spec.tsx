import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiTemplate } from "@src/types";
import { DEPENDENCIES, TemplateDetail } from "./TemplateDetail";

import { fireEvent, render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

const H100_SDL = `
version: "2.0"
services:
  llm:
    image: vllm/vllm-openai
    expose:
      - port: 8000
        to:
          - global: true
profiles:
  compute:
    llm:
      resources:
        cpu:
          units: 8
        memory:
          size: 64Gi
        storage:
          size: 100Gi
        gpu:
          units: 1
          attributes:
            vendor:
              nvidia:
                - model: h100
  placement:
    dcloud:
      pricing:
        llm:
          denom: uact
          amount: 1000
deployment:
  llm:
    dcloud:
      profile: llm
      count: 1
`;

describe(TemplateDetail.name, () => {
  it("shows the template's name without repeating the summary its README already opens with", () => {
    setup({});

    expect(screen.getByRole("heading", { level: 1, name: "ComfyUI" })).toBeInTheDocument();
    expect(screen.queryByText("The most powerful and modular stable diffusion GUI.")).not.toBeInTheDocument();
  });

  it("deploys the template through Configure", () => {
    setup({});

    expect(screen.getByRole("link", { name: "Deploy template" })).toHaveAttribute(
      "href",
      "/new-deployment/configure?templateId=akash-network-awesome-akash-comfyui"
    );
  });

  it("goes back to the previous page when the user arrived from within Console", () => {
    const { router, clickAndReportPrevented } = setup({ hasInAppHistory: true });

    const wasPrevented = clickAndReportPrevented(screen.getByRole("link", { name: "Back to templates" }));

    expect(wasPrevented).toBe(true);
    expect(router.back).toHaveBeenCalled();
  });

  it.each(["metaKey", "ctrlKey", "shiftKey", "altKey"] as const)("leaves a click with %s to the browser, to open the gallery elsewhere", modifier => {
    const { router, clickAndReportPrevented } = setup({ hasInAppHistory: true });

    const wasPrevented = clickAndReportPrevented(screen.getByRole("link", { name: "Back to templates" }), { [modifier]: true });

    expect(wasPrevented).toBe(false);
    expect(router.back).not.toHaveBeenCalled();
  });

  it("follows the link to the gallery when the user landed on the template directly", () => {
    const { router, clickAndReportPrevented } = setup({ hasInAppHistory: false });
    const backLink = screen.getByRole("link", { name: "Back to templates" });

    const wasPrevented = clickAndReportPrevented(backLink);

    expect(wasPrevented).toBe(false);
    expect(backLink).toHaveAttribute("href", "/templates");
    expect(router.back).not.toHaveBeenCalled();
  });

  it("shows the template's documents, its SDL among them", () => {
    const { TemplateDocuments } = setup({});

    expect(TemplateDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ template: expect.objectContaining({ id: "akash-network-awesome-akash-comfyui" }), showsSdl: true }),
      {}
    );
  });

  it("describes what the template deploys as from its SDL", () => {
    const { TemplateDeploysAs } = setup({});

    expect(TemplateDeploysAs).toHaveBeenCalledWith({ sdl: "version: '2.0'" }, {});
  });

  it("explains what happens before deploying", () => {
    setup({});

    expect(screen.getByRole("region", { name: "Before you deploy" })).toBeInTheDocument();
  });

  it.each([
    { case: "a trial user on a template that needs a blocked gpu", isTrialing: true, deploy: H100_SDL, isIntentFirst: true, offers: true },
    { case: "a paying user", isTrialing: false, deploy: H100_SDL, isIntentFirst: true, offers: false },
    { case: "a template the trial can run", isTrialing: true, deploy: "version: '2.0'", isIntentFirst: true, offers: false },
    { case: "onboarding_intent_first off", isTrialing: true, deploy: H100_SDL, isIntentFirst: false, offers: false }
  ])("offers the trial gpu alternatives only to $case: $offers", ({ isTrialing, deploy, isIntentFirst, offers }) => {
    const { BlockedGpuAlternatives, useFlag } = setup({ template: { deploy }, isTrialing, isIntentFirst });

    expect(BlockedGpuAlternatives.mock.calls.map(call => call[0])).toEqual(
      offers ? [{ templateId: "akash-network-awesome-akash-comfyui", placement: "template_detail" }] : []
    );
    expect(useFlag).toHaveBeenCalledWith("onboarding_intent_first");
  });

  function setup(input: { template?: Partial<ApiTemplate>; hasInAppHistory?: boolean; isTrialing?: boolean; isIntentFirst?: boolean }) {
    const template: ApiTemplate = {
      id: "akash-network-awesome-akash-comfyui",
      name: "ComfyUI",
      summary: "The most powerful and modular stable diffusion GUI.",
      readme: "# ComfyUI readme",
      deploy: "version: '2.0'",
      guide: "",
      githubUrl: "https://github.com/akash-network/awesome-akash/blob/9f6f799/comfyui",
      logoUrl: "https://example.com/comfyui.png",
      ...input.template
    };
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
    const TemplateDocuments = vi.fn(() => null);
    const TemplateDeploysAs = vi.fn(() => null);
    const BlockedGpuAlternatives = vi.fn(ComponentMock);
    const useFlag = vi.fn(() => input.isIntentFirst ?? false);
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing ?? false });
    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        publicConfig: { NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: ["nvidia/h100"] }
      });

    const dependencies = MockComponents(DEPENDENCIES, {
      useRouter: () => router,
      useHasInAppHistory: () => input.hasInAppHistory ?? false,
      useWallet,
      useFlag,
      useServices,
      TemplateDocuments,
      TemplateDeploysAs,
      BlockedGpuAlternatives
    });

    const { container } = render(<TemplateDetail template={template} dependencies={dependencies} />);

    const clickAndReportPrevented = (element: HTMLElement, init?: MouseEventInit) => {
      let wasPrevented = false;
      const recordAndStopNavigation = (event: Event) => {
        wasPrevented = event.defaultPrevented;
        event.preventDefault();
      };
      container.addEventListener("click", recordAndStopNavigation);
      fireEvent.click(element, init);
      container.removeEventListener("click", recordAndStopNavigation);
      return wasPrevented;
    };

    return { container, router, TemplateDocuments, TemplateDeploysAs, BlockedGpuAlternatives, useFlag, clickAndReportPrevented };
  }
});
