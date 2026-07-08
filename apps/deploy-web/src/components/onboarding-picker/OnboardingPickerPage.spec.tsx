import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { EnsureTrialStartedResult } from "@src/hooks/useEnsureTrialStarted";
import { UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, OnboardingPickerPage } from "./OnboardingPickerPage";

import { act, render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

const HELLO_WORLD_ID = "hello-world";
const IMAGE_GEN_ID = "akash-network-awesome-akash-stable-diffusion-ui";
const LLM_ID = "akash-network-awesome-akash-Llama-3.1-8B";

type PickerCardProps = Parameters<typeof DEPENDENCIES.DeploymentTemplatePickerCard>[0];
type SheetProps = Parameters<typeof DEPENDENCIES.AddCreditsSheet>[0];
type ButtonProps = Parameters<typeof DEPENDENCIES.Button>[0];

describe(OnboardingPickerPage.name, () => {
  it("renders a card per template", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ dependencies: { DeploymentTemplatePickerCard } });

    const titles = DeploymentTemplatePickerCard.mock.calls.map(call => (call[0] as PickerCardProps).title);
    expect(titles).toEqual(["Hello world", "Image Generation", "LLM Chatbot"]);
  });

  it("renders the trial credit amount from public config", () => {
    setup({ trialCreditsAmount: 1 });

    expect(screen.getByText("$1 in free trial credits")).toBeInTheDocument();
  });

  it("redirects to the configure view with the hello-world auto-deploy intent when its card deploys", () => {
    const push = vi.fn();
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ push, dependencies: { DeploymentTemplatePickerCard } });

    act(() => getCard(DeploymentTemplatePickerCard, "Hello world").onDeploy!());

    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: HELLO_WORLD_ID, sdlStrategy: "default", bidStrategy: "auto" }));
  });

  it("redirects to the configure view with the image-generation auto-deploy intent when its card deploys", () => {
    const push = vi.fn();
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ push, dependencies: { DeploymentTemplatePickerCard } });

    act(() => getCard(DeploymentTemplatePickerCard, "Image Generation").onDeploy!());

    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: IMAGE_GEN_ID, sdlStrategy: "default", bidStrategy: "auto" }));
  });

  it("renders an error alert when trial start fails terminally", () => {
    const useEnsureTrialStarted: () => EnsureTrialStartedResult = () => ({
      isWalletReady: false,
      isLoading: false,
      error: new Error("boom"),
      refreshWallet: vi.fn()
    });
    setup({ dependencies: { useEnsureTrialStarted } });

    expect(screen.getByText(/We couldn't set up your trial/i)).toBeInTheDocument();
  });

  it("does not render the error alert when trial start has not failed", () => {
    setup();

    expect(screen.queryByText(/We couldn't set up your trial/i)).not.toBeInTheDocument();
  });

  it("labels the LLM card with the unlock CTA when the user is still trialing", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ isTrialing: true, dependencies: { DeploymentTemplatePickerCard } });

    expect(getCard(DeploymentTemplatePickerCard, "LLM Chatbot").ctaLabel).toBe("Unlock full trial to deploy");
    expect(getCard(DeploymentTemplatePickerCard, "LLM Chatbot").ctaIcon).toBe("lock");
  });

  it("labels the LLM card with the deploy CTA once the user is no longer trialing", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ isTrialing: false, dependencies: { DeploymentTemplatePickerCard } });

    expect(getCard(DeploymentTemplatePickerCard, "LLM Chatbot").ctaLabel).toBe("Deploy now");
    expect(getCard(DeploymentTemplatePickerCard, "LLM Chatbot").ctaIcon).toBe("arrow");
  });

  it("keeps the gated LLM card enabled while the wallet is still being prepared", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({
      isTrialing: true,
      dependencies: {
        DeploymentTemplatePickerCard,
        useEnsureTrialStarted: () => ({ isWalletReady: false, isLoading: true, error: null, refreshWallet: vi.fn() })
      }
    });

    const card = getCard(DeploymentTemplatePickerCard, "LLM Chatbot");
    expect(card.disabled).toBeFalsy();
    expect(card.ctaLabel).toBe("Unlock full trial to deploy");
  });

  it("opens the verification sheet instead of redirecting when the LLM CTA is clicked while trialing", () => {
    const push = vi.fn();
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isTrialing: true, push, dependencies: { DeploymentTemplatePickerCard, AddCreditsSheet } });

    act(() => getCard(DeploymentTemplatePickerCard, "LLM Chatbot").onDeploy!());

    expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).open).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects to the LLM auto-deploy intent when the user is no longer trialing", () => {
    const push = vi.fn();
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ isTrialing: false, push, dependencies: { DeploymentTemplatePickerCard } });

    act(() => getCard(DeploymentTemplatePickerCard, "LLM Chatbot").onDeploy!());

    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: LLM_ID, sdlStrategy: "default", bidStrategy: "auto" }));
  });

  it("forwards isWalletReady to the verification sheet", () => {
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({
      isTrialing: true,
      dependencies: {
        AddCreditsSheet,
        useEnsureTrialStarted: () => ({ isWalletReady: false, isLoading: true, error: null, refreshWallet: vi.fn() })
      }
    });

    expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).isWalletReady).toBe(false);
  });

  it("closes the verification sheet when the sheet requests to close", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isTrialing: true, dependencies: { DeploymentTemplatePickerCard, AddCreditsSheet } });

    act(() => getCard(DeploymentTemplatePickerCard, "LLM Chatbot").onDeploy!());
    expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).open).toBe(true);

    act(() => (AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).onOpenChange(false));

    expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).open).toBe(false);
  });

  it("deploys the LLM template when the verification sheet completes after the gated LLM prompt", () => {
    const push = vi.fn();
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isTrialing: true, push, dependencies: { DeploymentTemplatePickerCard, AddCreditsSheet } });

    act(() => getCard(DeploymentTemplatePickerCard, "LLM Chatbot").onDeploy!());
    act(() => (AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).onDone(100, "Acme"));

    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: LLM_ID, sdlStrategy: "default", bidStrategy: "auto" }));
  });

  it("renders a button to skip the trial and unlock Console while trialing", () => {
    setup({ isTrialing: true });

    expect(screen.getByText(/Skip the trial - unlock Console/i)).toBeInTheDocument();
  });

  it("hides the skip-the-trial button once the user is no longer trialing", () => {
    setup({ isTrialing: false });

    expect(screen.queryByText(/Skip the trial - unlock Console/i)).not.toBeInTheDocument();
  });

  it("opens the verification sheet when the skip-the-trial button is clicked", () => {
    const push = vi.fn();
    // Button is a forwardRef component; a plain mock can't satisfy its ref type, so cast the override only.
    const Button = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isTrialing: true, push, dependencies: { Button: Button as unknown as typeof DEPENDENCIES.Button, AddCreditsSheet } });

    const skipButton = Button.mock.calls.at(-1)![0] as ButtonProps;
    act(() => (skipButton.onClick as () => void)());

    expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).open).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects to the configure view when the verification sheet completes after skipping the trial", () => {
    const push = vi.fn();
    const Button = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isTrialing: true, push, dependencies: { Button: Button as unknown as typeof DEPENDENCIES.Button, AddCreditsSheet } });

    const skipButton = Button.mock.calls.at(-1)![0] as ButtonProps;
    act(() => (skipButton.onClick as () => void)());
    act(() => (AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).onDone(100, "Acme"));

    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment());
  });

  function getCard(DeploymentTemplatePickerCard: ReturnType<typeof vi.fn>, title: string) {
    return DeploymentTemplatePickerCard.mock.calls.find(call => (call[0] as PickerCardProps).title === title)![0] as PickerCardProps;
  }

  function setup(
    input: {
      push?: () => void;
      isTrialing?: boolean;
      trialCreditsAmount?: number;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const push = input.push ?? vi.fn();
    const isTrialing = input.isTrialing ?? true;
    const trialCreditsAmount = input.trialCreditsAmount ?? 100;

    const useRouter: typeof DEPENDENCIES.useRouter = vi.fn(() => mock<AppRouterInstance>({ push }));
    const useEnsureTrialStarted: typeof DEPENDENCIES.useEnsureTrialStarted = vi.fn(() => ({
      isWalletReady: true,
      isLoading: false,
      error: null,
      refreshWallet: vi.fn()
    }));
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing });
    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({ publicConfig: { NEXT_PUBLIC_TRIAL_CREDITS_AMOUNT: trialCreditsAmount }, urlService: UrlService });

    return render(
      <OnboardingPickerPage dependencies={MockComponents(DEPENDENCIES, { useRouter, useEnsureTrialStarted, useWallet, useServices, ...input.dependencies })} />
    );
  }
});
