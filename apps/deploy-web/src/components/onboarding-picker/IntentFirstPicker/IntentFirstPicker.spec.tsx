import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, IntentFirstPicker } from "./IntentFirstPicker";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

type PickerCardProps = Parameters<typeof DEPENDENCIES.DeploymentTemplatePickerCard>[0];
type SkipButtonProps = Parameters<typeof DEPENDENCIES.SkipOnboardingButton>[0];

describe(IntentFirstPicker.name, () => {
  it("asks what the user wants to do first when no intent is picked", () => {
    setup({});

    expect(screen.getByRole("heading", { name: "What do you want to do first?" })).toBeInTheDocument();
    expect(screen.getByText("Pick one. The others stay one click away.")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("offers deploying an app and connecting an agent or code", () => {
    setup({});

    expect(screen.getByRole("button", { name: /Deploy an app/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect my agent or code/ })).toBeInTheDocument();
  });

  it("does not offer running an AI model yet", () => {
    setup({});

    expect(screen.queryByRole("button", { name: /Run an AI model/ })).not.toBeInTheDocument();
  });

  it("keeps asking the question when the url names an intent that isn't offered", () => {
    setup({ searchParams: "intent=model" });

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

  it("switches to another intent and tracks it as a switch", () => {
    const { push, analyticsService } = setup({ searchParams: "intent=app" });

    fireEvent.click(screen.getByRole("tab", { name: "Connect my agent or code" }));

    expect(push).toHaveBeenCalledWith(UrlService.onboardingPicker({ intent: "tools" }), { scroll: false });
    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_intent_selected", { category: "onboarding", intent: "tools", via: "switch" });
  });

  it("does nothing when the selected tab is clicked again", () => {
    const { push, analyticsService } = setup({ searchParams: "intent=app" });

    fireEvent.click(screen.getByRole("tab", { name: "Deploy an app" }));

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

  it("shows the api key guide and a link to create a key on the connect path", () => {
    const ApiKeyUsageGuide = vi.fn(ComponentMock);
    setup({ searchParams: "intent=tools", dependencies: { ApiKeyUsageGuide } });

    expect(ApiKeyUsageGuide).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /Create an API key/ })).toHaveAttribute("href", UrlService.userApiKeys());
    expect(screen.queryByRole("link", { name: /Deploy image/ })).not.toBeInTheDocument();
  });

  it("leaves the api key guide off the deploy an app path", () => {
    const ApiKeyUsageGuide = vi.fn(ComponentMock);
    setup({ searchParams: "intent=app", dependencies: { ApiKeyUsageGuide } });

    expect(ApiKeyUsageGuide).not.toHaveBeenCalled();
  });

  it.each(["", "intent=app"])("offers skipping with the picker source (%s)", searchParams => {
    const SkipOnboardingButton = vi.fn(ComponentMock);
    setup({ searchParams, dependencies: { SkipOnboardingButton } });

    expect(SkipOnboardingButton.mock.calls.at(-1)![0] as SkipButtonProps).toMatchObject({ source: "picker", label: "Skip for now" });
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
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const push = vi.fn();
    const onDeployTemplate = vi.fn();
    const onDeployImage = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const useRouter: typeof DEPENDENCIES.useRouter = () => mock<AppRouterInstance>({ push });
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
        dependencies={MockComponents(DEPENDENCIES, { useRouter, useSearchParams, useServices, ...input.dependencies })}
      />
    );

    return { push, onDeployTemplate, onDeployImage, analyticsService };
  }
});
