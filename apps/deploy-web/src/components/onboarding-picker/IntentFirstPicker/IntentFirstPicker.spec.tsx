import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, IntentFirstPicker } from "./IntentFirstPicker";

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

type PickerCardProps = Parameters<typeof DEPENDENCIES.DeploymentTemplatePickerCard>[0];
type SkipButtonProps = Parameters<typeof DEPENDENCIES.SkipOnboardingButton>[0];
type ApiKeySetupProps = Parameters<typeof DEPENDENCIES.ApiKeySetup>[0];
type OnboardingApiKey = ReturnType<typeof DEPENDENCIES.useOnboardingApiKey>;

describe(IntentFirstPicker.name, () => {
  it("asks what the user wants to do first when no intent is picked", () => {
    setup({});

    expect(screen.getByRole("heading", { name: "What do you want to do first?" })).toBeInTheDocument();
    expect(screen.getByText("Pick one. The others stay one click away.")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("offers deploying an app, connecting an agent or code and running an AI model", () => {
    setup({});

    expect(screen.getByRole("button", { name: /Deploy an app/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect my agent or code/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run an AI model/ })).toBeInTheDocument();
  });

  it("keeps asking the question when the url names an intent that isn't offered", () => {
    setup({ searchParams: "intent=unknown" });

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByText("Pick one. The others stay one click away.")).toBeInTheDocument();
  });

  it("asks the question while the search params aren't ready yet", () => {
    setup({ searchParams: null });

    expect(screen.getByText("Pick one. The others stay one click away.")).toBeInTheDocument();
  });

  it("puts the picked intent in the url and tracks it as answered from the question", () => {
    const { push, analyticsService } = setup({});

    fireEvent.click(screen.getByRole("button", { name: /Connect my agent or code/ }));

    expect(push).toHaveBeenCalledWith(UrlService.onboardingPicker({ intent: "tools" }), { scroll: false });
    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_intent_selected", { category: "onboarding", intent: "tools", via: "question" });
  });

  it("shows the intents as tabs with the picked one selected", () => {
    setup({ searchParams: "intent=app" });

    expect(screen.getByRole("tab", { name: "Deploy an app" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Connect my agent or code" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Start from a template or your own Docker image.")).toBeInTheDocument();
  });

  it("switches to another intent and tracks it as a switch", async () => {
    const { push, analyticsService } = setup({ searchParams: "intent=app" });

    await userEvent.click(screen.getByRole("tab", { name: "Connect my agent or code" }));

    expect(push).toHaveBeenCalledWith(UrlService.onboardingPicker({ intent: "tools" }), { scroll: false });
    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_intent_selected", { category: "onboarding", intent: "tools", via: "switch" });
  });

  it("switches intent with the arrow keys", async () => {
    const { push } = setup({ searchParams: "intent=app" });

    screen.getByRole("tab", { name: "Deploy an app" }).focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(push).toHaveBeenCalledWith(UrlService.onboardingPicker({ intent: "tools" }), { scroll: false });
  });

  it("keeps the coupon deep link when an intent is picked", () => {
    const { push } = setup({ searchParams: "redeemCoupon=true" });

    fireEvent.click(screen.getByRole("button", { name: /Connect my agent or code/ }));

    expect(push).toHaveBeenCalledWith(UrlService.onboardingPicker({ intent: "tools", redeemCoupon: true }), { scroll: false });
  });

  it("does nothing when the selected tab is clicked again", async () => {
    const { push, analyticsService } = setup({ searchParams: "intent=app" });

    await userEvent.click(screen.getByRole("tab", { name: "Deploy an app" }));

    expect(push).not.toHaveBeenCalled();
    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it("shows hello world and the trial agent on the deploy an app path", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ searchParams: "intent=app", dependencies: { DeploymentTemplatePickerCard } });

    const cards = DeploymentTemplatePickerCard.mock.calls.map(call => call[0] as PickerCardProps);
    expect(cards.map(card => [card.chip, card.title, card.priceRest, card.ctaVariant])).toEqual([
      ["Quick start", "Hello world", "0.5 vCPU · 512 MiB", "primary"],
      ["Picked for your trial", "Space Agent", "4 vCPU · 8 GiB", "outline"]
    ]);
  });

  it("picks the agent that fits the configured trial limits", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ searchParams: "intent=app", maxCpu: 3, dependencies: { DeploymentTemplatePickerCard } });

    expect(getCard(DeploymentTemplatePickerCard, "OpenClaw")).toBeDefined();
  });

  it("leaves out an agent whose memory exceeds the configured trial limit", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ searchParams: "intent=app", maxMemoryGi: 4, dependencies: { DeploymentTemplatePickerCard } });

    expect(getCard(DeploymentTemplatePickerCard, "Space Agent")).toBeUndefined();
    expect(getCard(DeploymentTemplatePickerCard, "Hermes Agent")).toBeDefined();
  });

  it("deploys the template behind a card", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const { onDeployTemplate } = setup({ searchParams: "intent=app", dependencies: { DeploymentTemplatePickerCard } });

    act(() => getCard(DeploymentTemplatePickerCard, "Space Agent")!.onDeploy!());

    expect(onDeployTemplate).toHaveBeenCalledWith("akash-network-awesome-akash-Space-Agent");
  });

  it("labels the cards with the deploy action while the user has credit", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ searchParams: "intent=app", isOutOfCredit: false, dependencies: { DeploymentTemplatePickerCard } });

    const card = getCard(DeploymentTemplatePickerCard, "Hello world")!;
    expect([card.ctaLabel, card.ctaIcon]).toEqual(["Deploy now", "arrow"]);
  });

  it("labels the cards with the add credits action once the user has no credit left", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ searchParams: "intent=app", isOutOfCredit: true, dependencies: { DeploymentTemplatePickerCard } });

    const card = getCard(DeploymentTemplatePickerCard, "Hello world")!;
    expect([card.ctaLabel, card.ctaIcon]).toEqual(["Add credits to deploy", "lock"]);
  });

  it("links the docker image strip to the configure screen and reports the click", () => {
    const { onDeployImage } = setup({ searchParams: "intent=app" });

    const link = screen.getByRole("link", { name: /Deploy image/ });
    fireEvent.click(link);

    expect(link).toHaveAttribute("href", UrlService.configureDeployment({ exampleImage: true }));
    expect(onDeployImage).toHaveBeenCalled();
  });

  it("hands the onboarding api key to the key setup on the connect path", () => {
    const ApiKeySetup = vi.fn(ComponentMock);
    const onboardingApiKey = mock<OnboardingApiKey>({ createdApiKey: undefined, isCreating: true, isLoadingTrialProject: false });
    setup({ searchParams: "intent=tools", onboardingApiKey, dependencies: { ApiKeySetup } });

    expect(ApiKeySetup.mock.calls.at(-1)![0] as ApiKeySetupProps).toMatchObject({
      createdApiKey: undefined,
      isCreating: true,
      isLoadingTrialProject: false,
      onCreate: onboardingApiKey.createApiKey
    });
    expect(screen.queryByRole("link", { name: /Deploy image/ })).not.toBeInTheDocument();
  });

  it("opens the run an AI model path from a deep link", () => {
    const RunModelPath = vi.fn(ComponentMock);
    const { onDeployTemplate } = setup({ searchParams: "intent=model", isOutOfCredit: true, dependencies: { RunModelPath } });

    expect(screen.getByRole("tab", { name: "Run an AI model" })).toHaveAttribute("aria-selected", "true");
    expect(RunModelPath.mock.calls.at(-1)![0]).toEqual({ isOutOfCredit: true, onDeployTemplate });
  });

  it("puts the run an AI model intent in the url when it is picked", () => {
    const { push, analyticsService } = setup({});

    fireEvent.click(screen.getByRole("button", { name: /Run an AI model/ }));

    expect(push).toHaveBeenCalledWith(UrlService.onboardingPicker({ intent: "model" }), { scroll: false });
    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_intent_selected", { category: "onboarding", intent: "model", via: "question" });
  });

  it("leaves the model path off the deploy an app path", () => {
    const RunModelPath = vi.fn(ComponentMock);
    setup({ searchParams: "intent=app", dependencies: { RunModelPath } });

    expect(RunModelPath).not.toHaveBeenCalled();
  });

  it("leaves the key setup off the deploy an app path", () => {
    const ApiKeySetup = vi.fn(ComponentMock);
    setup({ searchParams: "intent=app", dependencies: { ApiKeySetup } });

    expect(ApiKeySetup).not.toHaveBeenCalled();
  });

  it.each([
    { searchParams: "intent=tools", enabled: true },
    { searchParams: "intent=app", enabled: false },
    { searchParams: "", enabled: false }
  ])("prepares the onboarding api key only on the connect path ($searchParams)", ({ searchParams, enabled }) => {
    const { useOnboardingApiKey } = setup({ searchParams });

    expect(useOnboardingApiKey).toHaveBeenCalledWith({ enabled });
  });

  it.each(["", "intent=app", "intent=tools"])("offers skipping with the picker source until a key exists (%s)", searchParams => {
    const SkipOnboardingButton = vi.fn(ComponentMock);
    setup({ searchParams, dependencies: { SkipOnboardingButton } });

    expect(SkipOnboardingButton.mock.calls.at(-1)![0] as SkipButtonProps).toMatchObject({ source: "picker", label: "Skip for now" });
  });

  it("offers continuing to Console once a key exists, recording onboarding as done through the key", () => {
    const SkipOnboardingButton = vi.fn(ComponentMock);
    const onboardingApiKey = mock<OnboardingApiKey>({ createdApiKey: mock<ApiKeyResponse>() });
    setup({ searchParams: "intent=tools", onboardingApiKey, dependencies: { SkipOnboardingButton } });

    expect(SkipOnboardingButton.mock.calls.at(-1)![0] as SkipButtonProps).toMatchObject({ source: "api_key", label: "Continue to Console" });
  });

  it("opens the coupon entry from the footer link", () => {
    const onRedeemCoupon = vi.fn();
    setup({ onRedeemCoupon });

    fireEvent.click(screen.getByRole("button", { name: "Have a coupon code?" }));

    expect(onRedeemCoupon).toHaveBeenCalled();
  });

  it("hides the coupon link when coupon entry isn't offered", () => {
    setup({});

    expect(screen.queryByRole("button", { name: "Have a coupon code?" })).not.toBeInTheDocument();
  });

  function getCard(DeploymentTemplatePickerCard: ReturnType<typeof vi.fn>, title: string) {
    return DeploymentTemplatePickerCard.mock.calls.map(call => call[0] as PickerCardProps).find(props => props.title === title);
  }

  function setup(input: {
    searchParams?: string | null;
    isOutOfCredit?: boolean;
    maxCpu?: number;
    maxMemoryGi?: number;
    onRedeemCoupon?: () => void;
    onboardingApiKey?: OnboardingApiKey;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const push = vi.fn();
    const onDeployTemplate = vi.fn();
    const onDeployImage = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const useRouter: typeof DEPENDENCIES.useRouter = () => mock<AppRouterInstance>({ push });
    const useOnboardingApiKey = vi.fn<typeof DEPENDENCIES.useOnboardingApiKey>(
      () => input.onboardingApiKey ?? mock<OnboardingApiKey>({ createdApiKey: undefined })
    );
    const useSearchParams: typeof DEPENDENCIES.useSearchParams = () =>
      (input.searchParams === null ? null : new URLSearchParams(input.searchParams ?? "")) as ReadonlyURLSearchParams;
    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        publicConfig: {
          NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_CPU: input.maxCpu ?? 4,
          NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_MEMORY_GI: input.maxMemoryGi ?? 16,
          NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: ["nvidia/h100"]
        },
        urlService: UrlService,
        analyticsService
      });

    render(
      <IntentFirstPicker
        isOutOfCredit={input.isOutOfCredit ?? false}
        onDeployTemplate={onDeployTemplate}
        onDeployImage={onDeployImage}
        onRedeemCoupon={input.onRedeemCoupon}
        dependencies={MockComponents(DEPENDENCIES, { useRouter, useSearchParams, useServices, useOnboardingApiKey, ...input.dependencies })}
      />
    );

    return { push, onDeployTemplate, onDeployImage, analyticsService, useOnboardingApiKey };
  }
});
