import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { EnsureTrialStartedResult } from "@src/hooks/useEnsureTrialStarted";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { gemmaTrialTemplate } from "@src/utils/templates";
import { UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, OnboardingPickerPage } from "./OnboardingPickerPage";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

const HELLO_WORLD_ID = "hello-world";
const SPACE_AGENT_ID = "akash-network-awesome-akash-Space-Agent";
const LLM_ID = "akash-network-awesome-akash-Llama-3.1-8B";

type PickerCardProps = Parameters<typeof DEPENDENCIES.DeploymentTemplatePickerCard>[0];
type SheetProps = Parameters<typeof DEPENDENCIES.AddCreditsSheet>[0];
type ButtonProps = Parameters<typeof DEPENDENCIES.Button>[0];
type IntentFirstPickerProps = Parameters<typeof DEPENDENCIES.IntentFirstPicker>[0];

describe(OnboardingPickerPage.name, () => {
  it("renders a card per template", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ dependencies: { DeploymentTemplatePickerCard } });

    const titles = DeploymentTemplatePickerCard.mock.calls.map(call => (call[0] as PickerCardProps).title);
    expect(titles).toEqual(["Hello world", "Space Agent", "LLM Chatbot"]);
  });

  it("renders the trial credit amount from public config", () => {
    setup({ trialCreditsAmount: 1 });

    expect(screen.getByText("$1 in free trial credits")).toBeInTheDocument();
  });

  it("renders the first-purchase bonus offer", () => {
    const { container } = setup({});

    expect(container).toHaveTextContent("up to $100 free credits, full GPU access and 30 day deployments");
    expect(container).toHaveTextContent("Plus, get 10% in bonus credits on your first purchase, up to $100.");
  });

  it("marks hello-world and redirects to the configure view with its auto-deploy intent when its card deploys", () => {
    const push = vi.fn();
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const { markAutoDeployStart } = setup({ push, dependencies: { DeploymentTemplatePickerCard } });

    act(() => getCard(DeploymentTemplatePickerCard, "Hello world").onDeploy!());

    expect(markAutoDeployStart).toHaveBeenCalledWith(HELLO_WORLD_ID);
    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: HELLO_WORLD_ID, sdlStrategy: "default", bidStrategy: "auto" }));
  });

  it("marks space-agent and redirects to the configure view with its auto-deploy intent when its card deploys", () => {
    const push = vi.fn();
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const { markAutoDeployStart } = setup({ push, dependencies: { DeploymentTemplatePickerCard } });

    act(() => getCard(DeploymentTemplatePickerCard, "Space Agent").onDeploy!());

    expect(markAutoDeployStart).toHaveBeenCalledWith(SPACE_AGENT_ID);
    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: SPACE_AGENT_ID, sdlStrategy: "default", bidStrategy: "auto" }));
  });

  it("labels the LLM card with the unlock CTA when the user is still trialing", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ isTrialing: true, dependencies: { DeploymentTemplatePickerCard } });

    expect(getCard(DeploymentTemplatePickerCard, "LLM Chatbot").ctaLabel).toBe("Add credits to unlock");
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
        useEnsureTrialStarted: () => mock<EnsureTrialStartedResult>({ wallet: undefined, isWalletReady: false, isLoading: true })
      }
    });

    const card = getCard(DeploymentTemplatePickerCard, "LLM Chatbot");
    expect(card.disabled).toBeFalsy();
    expect(card.ctaLabel).toBe("Add credits to unlock");
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

  it("closes the verification sheet when the sheet requests to close", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isTrialing: true, dependencies: { DeploymentTemplatePickerCard, AddCreditsSheet } });

    act(() => getCard(DeploymentTemplatePickerCard, "LLM Chatbot").onDeploy!());
    expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).open).toBe(true);

    act(() => (AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).onOpenChange(false));

    expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).open).toBe(false);
  });

  it("closes the verification sheet without deploying when a coupon is redeemed", () => {
    const push = vi.fn();
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isTrialing: true, push, dependencies: { DeploymentTemplatePickerCard, AddCreditsSheet } });

    act(() => getCard(DeploymentTemplatePickerCard, "LLM Chatbot").onDeploy!());
    expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).open).toBe(true);

    act(() => (AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).onRedeemed!());

    expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).open).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("deploys the LLM template when the verification sheet completes after the gated LLM prompt", () => {
    const push = vi.fn();
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isTrialing: true, push, dependencies: { DeploymentTemplatePickerCard, AddCreditsSheet } });

    act(() => getCard(DeploymentTemplatePickerCard, "LLM Chatbot").onDeploy!());
    act(() => (AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).onDone(100));

    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: LLM_ID, sdlStrategy: "default", bidStrategy: "auto" }));
  });

  it("labels the purchase confirmation with the deploy step when the sheet unlocks the LLM template", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isTrialing: true, dependencies: { DeploymentTemplatePickerCard, AddCreditsSheet } });

    act(() => getCard(DeploymentTemplatePickerCard, "LLM Chatbot").onDeploy!());

    expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).nextStepLabel).toBe("Continue to deploy");
  });

  it("leaves the purchase confirmation on its default label when the sheet opens for a hackathon coupon", () => {
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isTrialing: true, isHackathonsEnabled: true, searchParams: "redeemCoupon=true", dependencies: { AddCreditsSheet } });

    const sheetProps = AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps;
    expect(sheetProps.open).toBe(true);
    expect(sheetProps.nextStepLabel).toBeUndefined();
  });

  it("renders the skip-onboarding button in the body with the picker source", () => {
    const SkipOnboardingButton = vi.fn(ComponentMock);
    setup({ dependencies: { SkipOnboardingButton } });

    expect((SkipOnboardingButton.mock.calls.at(-1)![0] as { source?: string }).source).toBe("picker");
  });

  it("keeps the skip-onboarding button visible after the trial ends", () => {
    const SkipOnboardingButton = vi.fn(ComponentMock);
    setup({ isTrialing: false, dependencies: { SkipOnboardingButton } });

    expect(SkipOnboardingButton).toHaveBeenCalled();
  });

  it("renders a 'Hackathon? click here' header link while trialing when the hackathons flag is on", () => {
    setup({ isTrialing: true, isHackathonsEnabled: true });

    expect(screen.getByText(/Hackathon\? click here/i)).toBeInTheDocument();
  });

  it("hides the hackathon link when the hackathons flag is off", () => {
    setup({ isTrialing: true, isHackathonsEnabled: false });

    expect(screen.queryByText(/Hackathon\? click here/i)).not.toBeInTheDocument();
  });

  it("hides the hackathon link when the user is no longer trialing", () => {
    setup({ isTrialing: false, isHackathonsEnabled: true });

    expect(screen.queryByText(/Hackathon\? click here/i)).not.toBeInTheDocument();
  });

  it("opens the add-credits sheet on the coupon tab when the hackathon link is clicked", () => {
    const push = vi.fn();
    const Button = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({
      isTrialing: true,
      isHackathonsEnabled: true,
      push,
      dependencies: { Button: Button as unknown as typeof DEPENDENCIES.Button, AddCreditsSheet }
    });

    const hackathonButton = getButtonByText(Button, "Hackathon? click here");
    act(() => (hackathonButton.onClick as () => void)());

    const sheetProps = AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps;
    expect(sheetProps.open).toBe(true);
    expect(sheetProps.initialTab).toBe("coupon");
    expect(push).not.toHaveBeenCalled();
  });

  it("opens the add-credits sheet on the coupon tab and strips the param when landing with redeemCoupon=true", () => {
    const replace = vi.fn();
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isTrialing: true, isHackathonsEnabled: true, searchParams: "redeemCoupon=true", replace, dependencies: { AddCreditsSheet } });

    const sheetProps = AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps;
    expect(sheetProps.open).toBe(true);
    expect(sheetProps.initialTab).toBe("coupon");
    expect(replace).toHaveBeenCalledWith(UrlService.onboardingPicker(), { scroll: false });
  });

  it("ignores the redeemCoupon param when the hackathons flag is off", () => {
    const replace = vi.fn();
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isTrialing: true, isHackathonsEnabled: false, searchParams: "redeemCoupon=true", replace, dependencies: { AddCreditsSheet } });

    expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).open).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("ignores the redeemCoupon param when the user is not trialing", () => {
    const replace = vi.fn();
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isTrialing: false, isHackathonsEnabled: true, searchParams: "redeemCoupon=true", replace, dependencies: { AddCreditsSheet } });

    expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).open).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("tracks a deploy click for the hello-world template", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const { analyticsService } = setup({ dependencies: { DeploymentTemplatePickerCard } });

    act(() => getCard(DeploymentTemplatePickerCard, "Hello world").onDeploy!());

    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_deploy_click", { category: "onboarding", option: HELLO_WORLD_ID });
  });

  it("tracks a deploy click for the space-agent template", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const { analyticsService } = setup({ dependencies: { DeploymentTemplatePickerCard } });

    act(() => getCard(DeploymentTemplatePickerCard, "Space Agent").onDeploy!());

    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_deploy_click", { category: "onboarding", option: SPACE_AGENT_ID });
  });

  it("tracks a deploy click for the llm template once the user is no longer trialing", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const { analyticsService } = setup({ isTrialing: false, dependencies: { DeploymentTemplatePickerCard } });

    act(() => getCard(DeploymentTemplatePickerCard, "LLM Chatbot").onDeploy!());

    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_deploy_click", { category: "onboarding", option: LLM_ID });
  });

  it("opens the configure screen with the example image filled in from the Deploy image link", () => {
    setup({});

    expect(screen.getByRole("link", { name: /deploy image/i })).toHaveAttribute("href", UrlService.configureDeployment({ exampleImage: true }));
  });

  it("tracks a deploy click with the custom-image option from the Deploy image link", () => {
    const { analyticsService } = setup({});

    act(() => fireEvent.click(screen.getByRole("link", { name: /deploy image/i })));

    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_deploy_click", { category: "onboarding", option: "custom-image" });
  });

  it("flushes the deploy click before redirecting so it survives the navigation", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const { analyticsService } = setup({ dependencies: { DeploymentTemplatePickerCard } });

    act(() => getCard(DeploymentTemplatePickerCard, "Hello world").onDeploy!());

    expect(analyticsService.flush).toHaveBeenCalled();
  });

  it("flushes the deploy click when the custom-image Deploy image link is clicked", () => {
    const { analyticsService } = setup({});

    act(() => fireEvent.click(screen.getByRole("link", { name: /deploy image/i })));

    expect(analyticsService.flush).toHaveBeenCalled();
  });

  it("tracks a deploy click with the llm option when the gated LLM card is clicked while trialing", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const { analyticsService } = setup({ isTrialing: true, dependencies: { DeploymentTemplatePickerCard } });

    act(() => getCard(DeploymentTemplatePickerCard, "LLM Chatbot").onDeploy!());

    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_deploy_click", { category: "onboarding", option: LLM_ID });
  });

  it("fires the gated LLM deploy click once and does not re-fire it when the sheet completes", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    const { analyticsService } = setup({ isTrialing: true, dependencies: { DeploymentTemplatePickerCard, AddCreditsSheet } });

    act(() => getCard(DeploymentTemplatePickerCard, "LLM Chatbot").onDeploy!());
    act(() => (AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).onDone(100));

    const deployClicks = analyticsService.track.mock.calls.filter(call => call[0] === "onboarding_deploy_click");
    expect(deployClicks).toHaveLength(1);
  });

  it("tells the user how much free trial credit they start with while they still have credit", () => {
    const { container } = setup({ isOutOfCredit: false, trialCreditsAmount: 1 });

    expect(container).toHaveTextContent("We've provided you with $1 in free trial credits. This covers a couple of smaller deployments");
  });

  it("tells a trialing user their trial is over and offers the first-purchase bonus once they have no credit left", () => {
    const { container } = setup({ isTrialing: true, isOutOfCredit: true });

    expect(container).toHaveTextContent(
      "Your free trial is over. Add credits to deploy one of these templates. Your first purchase gets 10% in bonus credits, up to $100, and unlocks full GPU access and 30 day deployments."
    );
    expect(screen.queryByText(/in free trial credits/)).not.toBeInTheDocument();
  });

  it("tells a paid user they are out of credits once they have no credit left", () => {
    const { container } = setup({ isTrialing: false, isOutOfCredit: true });

    expect(container).toHaveTextContent("You're out of credits. Add credits to deploy one of these templates.");
    expect(container).not.toHaveTextContent("Your free trial is over");
    expect(screen.queryByText(/in free trial credits/)).not.toBeInTheDocument();
  });

  it.each(["Hello world", "Space Agent"])("labels the %s card with the deploy CTA while the user has credit", title => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ isOutOfCredit: false, dependencies: { DeploymentTemplatePickerCard } });

    expect(getCard(DeploymentTemplatePickerCard, title).ctaLabel).toBe("Deploy now");
    expect(getCard(DeploymentTemplatePickerCard, title).ctaIcon).toBe("arrow");
  });

  it.each(["Hello world", "Space Agent"])("labels the %s card with the add-credits CTA and keeps its price once the user has no credit left", title => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ isOutOfCredit: true, dependencies: { DeploymentTemplatePickerCard } });

    const card = getCard(DeploymentTemplatePickerCard, title);
    expect(card.ctaLabel).toBe("Add credits to deploy");
    expect(card.ctaIcon).toBe("lock");
    expect(card.priceBold).toMatch(/^~\$/);
  });

  it("opens the add-credits sheet for the out-of-credit funnel instead of redirecting when a card is pressed without credit", () => {
    const push = vi.fn();
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isOutOfCredit: true, push, dependencies: { DeploymentTemplatePickerCard, AddCreditsSheet } });

    act(() => getCard(DeploymentTemplatePickerCard, "Hello world").onDeploy!());

    const sheetProps = AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps;
    expect(sheetProps.open).toBe(true);
    expect(sheetProps.context).toBe("out-of-credit");
    expect(sheetProps.initialTab).toBe("purchase");
    expect(sheetProps.nextStepLabel).toBe("Continue to deploy");
    expect(sheetProps.description).toBe("Your balance is too low to start a deployment. Add credits, then continue to deploy this template.");
    expect(push).not.toHaveBeenCalled();
  });

  it("still tracks the deploy click when a card is pressed without credit", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const { analyticsService } = setup({ isOutOfCredit: true, dependencies: { DeploymentTemplatePickerCard } });

    act(() => getCard(DeploymentTemplatePickerCard, "Space Agent").onDeploy!());

    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_deploy_click", { category: "onboarding", option: SPACE_AGENT_ID });
  });

  it.each([
    { title: "Hello world", templateId: HELLO_WORLD_ID },
    { title: "Space Agent", templateId: SPACE_AGENT_ID }
  ])("deploys the $title template once credits are added after pressing its card without credit", ({ title, templateId }) => {
    const push = vi.fn();
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    const { markAutoDeployStart } = setup({ isOutOfCredit: true, push, dependencies: { DeploymentTemplatePickerCard, AddCreditsSheet } });

    act(() => getCard(DeploymentTemplatePickerCard, title).onDeploy!());
    expect(markAutoDeployStart).not.toHaveBeenCalled();
    act(() => (AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).onDone(100));

    expect(markAutoDeployStart).toHaveBeenCalledWith(templateId);
    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId, sdlStrategy: "default", bidStrategy: "auto" }));
  });

  it("opens the add-credits sheet with the gpu unlock context and its default description for the gated LLM card", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isTrialing: true, isOutOfCredit: true, dependencies: { DeploymentTemplatePickerCard, AddCreditsSheet } });

    act(() => getCard(DeploymentTemplatePickerCard, "LLM Chatbot").onDeploy!());

    const sheetProps = AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps;
    expect(sheetProps.context).toBe("unlock-gpu");
    expect(sheetProps.description).toBeUndefined();
  });

  it("keeps the add-credits sheet open when it reports itself open", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({ isOutOfCredit: true, dependencies: { DeploymentTemplatePickerCard, AddCreditsSheet } });

    act(() => getCard(DeploymentTemplatePickerCard, "Hello world").onDeploy!());
    act(() => (AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).onOpenChange(true));

    expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).open).toBe(true);
  });

  it("closes the hackathon coupon sheet without deploying when a purchase completes", () => {
    const push = vi.fn();
    const Button = vi.fn(ComponentMock);
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({
      isTrialing: true,
      isHackathonsEnabled: true,
      push,
      dependencies: { Button: Button as unknown as typeof DEPENDENCIES.Button, AddCreditsSheet }
    });

    act(() => (getButtonByText(Button, "Hackathon? click here").onClick as () => void)());
    const sheetProps = AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps;
    expect(sheetProps.context).toBe("hackathon-coupon");
    act(() => sheetProps.onDone(100));

    expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).open).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  describe("when the onboarding_intent_first flag is on", () => {
    it("renders the question-first picker instead of the template cards", () => {
      const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
      const IntentFirstPicker = vi.fn(ComponentMock);
      setup({ isIntentFirst: true, dependencies: { DeploymentTemplatePickerCard, IntentFirstPicker } });

      expect(IntentFirstPicker).toHaveBeenCalled();
      expect(DeploymentTemplatePickerCard).not.toHaveBeenCalled();
      expect(screen.queryByText(/in free trial credits/)).not.toBeInTheDocument();
    });

    it("keeps the legacy picker when the flag is off", () => {
      const IntentFirstPicker = vi.fn(ComponentMock);
      setup({ isIntentFirst: false, dependencies: { IntentFirstPicker } });

      expect(IntentFirstPicker).not.toHaveBeenCalled();
    });

    it("redirects to the auto-deploy intent when a template is deployed with credit left", () => {
      const push = vi.fn();
      const IntentFirstPicker = vi.fn(ComponentMock);
      const { analyticsService } = setup({ isIntentFirst: true, push, dependencies: { IntentFirstPicker } });

      act(() => getIntentFirstPickerProps(IntentFirstPicker).onDeployTemplate(SPACE_AGENT_ID));

      expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: SPACE_AGENT_ID, sdlStrategy: "default", bidStrategy: "auto" }));
      expect(analyticsService.track).toHaveBeenCalledWith("onboarding_deploy_click", { category: "onboarding", option: SPACE_AGENT_ID });
    });

    it("deploys hello world from the question through the same auto-deploy intent and counts it as a deploy from the question", () => {
      const push = vi.fn();
      const IntentFirstPicker = vi.fn(ComponentMock);
      const { analyticsService, markAutoDeployStart } = setup({ isIntentFirst: true, push, dependencies: { IntentFirstPicker } });

      act(() => getIntentFirstPickerProps(IntentFirstPicker).onDeployTemplate(HELLO_WORLD_ID, "question"));

      expect(markAutoDeployStart).toHaveBeenCalledWith(HELLO_WORLD_ID);
      expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: HELLO_WORLD_ID, sdlStrategy: "default", bidStrategy: "auto" }));
      expect(analyticsService.track).toHaveBeenCalledWith("onboarding_deploy_click", { category: "onboarding", option: HELLO_WORLD_ID, via: "question" });
    });

    it("redirects a model card deploy to the auto-deploy intent of its gpu-pinned template", () => {
      const push = vi.fn();
      const IntentFirstPicker = vi.fn(ComponentMock);
      setup({ isIntentFirst: true, push, dependencies: { IntentFirstPicker } });

      act(() => getIntentFirstPickerProps(IntentFirstPicker).onDeployTemplate(gemmaTrialTemplate.code));

      expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: "gemma-3-4b-v100", sdlStrategy: "default", bidStrategy: "auto" }));
    });

    it("opens the out-of-credit sheet when a template is deployed without credit", () => {
      const push = vi.fn();
      const IntentFirstPicker = vi.fn(ComponentMock);
      const AddCreditsSheet = vi.fn(ComponentMock);
      setup({ isIntentFirst: true, isOutOfCredit: true, push, dependencies: { IntentFirstPicker, AddCreditsSheet } });

      expect(getIntentFirstPickerProps(IntentFirstPicker).isOutOfCredit).toBe(true);
      act(() => getIntentFirstPickerProps(IntentFirstPicker).onDeployTemplate(HELLO_WORLD_ID));

      expect((AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).context).toBe("out-of-credit");
      expect(push).not.toHaveBeenCalled();
    });

    it("tracks the custom image deploy click", () => {
      const IntentFirstPicker = vi.fn(ComponentMock);
      const { analyticsService } = setup({ isIntentFirst: true, dependencies: { IntentFirstPicker } });

      act(() => getIntentFirstPickerProps(IntentFirstPicker).onDeployImage());

      expect(analyticsService.track).toHaveBeenCalledWith("onboarding_deploy_click", { category: "onboarding", option: "custom-image" });
    });

    it("opens the coupon tab from the picker's coupon link and drops the header link", () => {
      const IntentFirstPicker = vi.fn(ComponentMock);
      const AddCreditsSheet = vi.fn(ComponentMock);
      setup({ isIntentFirst: true, isTrialing: true, isHackathonsEnabled: true, dependencies: { IntentFirstPicker, AddCreditsSheet } });

      act(() => getIntentFirstPickerProps(IntentFirstPicker).onRedeemCoupon!());

      const sheetProps = AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps;
      expect(sheetProps.open).toBe(true);
      expect(sheetProps.initialTab).toBe("coupon");
      expect(screen.queryByText(/Hackathon\? click here/i)).not.toBeInTheDocument();
    });

    it.each([
      { isTrialing: false, isHackathonsEnabled: true },
      { isTrialing: true, isHackathonsEnabled: false }
    ])("offers no coupon link when trialing is $isTrialing and hackathons is $isHackathonsEnabled", ({ isTrialing, isHackathonsEnabled }) => {
      const IntentFirstPicker = vi.fn(ComponentMock);
      setup({ isIntentFirst: true, isTrialing, isHackathonsEnabled, dependencies: { IntentFirstPicker } });

      expect(getIntentFirstPickerProps(IntentFirstPicker).onRedeemCoupon).toBeUndefined();
    });

    it("opens the coupon tab from the redeemCoupon deep link", () => {
      const replace = vi.fn();
      const AddCreditsSheet = vi.fn(ComponentMock);
      setup({
        isIntentFirst: true,
        isTrialing: true,
        isHackathonsEnabled: true,
        searchParams: "redeemCoupon=true",
        replace,
        dependencies: { AddCreditsSheet }
      });

      const sheetProps = AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps;
      expect(sheetProps.open).toBe(true);
      expect(sheetProps.initialTab).toBe("coupon");
      expect(replace).toHaveBeenCalledWith(UrlService.onboardingPicker(), { scroll: false });
    });

    it("keeps the picked intent when it strips the coupon deep link", () => {
      const replace = vi.fn();
      setup({ isIntentFirst: true, isTrialing: true, isHackathonsEnabled: true, searchParams: "intent=tools&redeemCoupon=true", replace });

      expect(replace).toHaveBeenCalledWith(UrlService.onboardingPicker({ intent: "tools" }), { scroll: false });
    });
  });

  function getIntentFirstPickerProps(IntentFirstPicker: ReturnType<typeof vi.fn>) {
    return IntentFirstPicker.mock.calls.at(-1)![0] as IntentFirstPickerProps;
  }

  function getCard(DeploymentTemplatePickerCard: ReturnType<typeof vi.fn>, title: string) {
    return DeploymentTemplatePickerCard.mock.calls.find(call => (call[0] as PickerCardProps).title === title)![0] as PickerCardProps;
  }

  function getButtonByText(Button: ReturnType<typeof vi.fn>, text: string) {
    return Button.mock.calls
      .map(call => call[0] as ButtonProps)
      .find(props => {
        const children = Array.isArray(props.children) ? props.children : [props.children];
        return children.some(child => typeof child === "string" && child.includes(text));
      })!;
  }

  function setup(
    input: {
      push?: () => void;
      replace?: () => void;
      searchParams?: string;
      isTrialing?: boolean;
      isHackathonsEnabled?: boolean;
      isIntentFirst?: boolean;
      isOutOfCredit?: boolean;
      trialCreditsAmount?: number;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const push = input.push ?? vi.fn();
    const replace = input.replace ?? vi.fn();
    const markAutoDeployStart = vi.fn();
    const isTrialing = input.isTrialing ?? true;
    const isHackathonsEnabled = input.isHackathonsEnabled ?? false;
    const trialCreditsAmount = input.trialCreditsAmount ?? 100;

    const useRouter: typeof DEPENDENCIES.useRouter = vi.fn(() => mock<AppRouterInstance>({ push, replace }));
    const useSearchParams: typeof DEPENDENCIES.useSearchParams = () => new URLSearchParams(input.searchParams ?? "") as ReadonlyURLSearchParams;
    const useEnsureTrialStarted: typeof DEPENDENCIES.useEnsureTrialStarted = vi.fn(() =>
      mock<EnsureTrialStartedResult>({
        isWalletReady: true,
        isLoading: false
      })
    );
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing });
    const useIsOutOfDeployCredit: typeof DEPENDENCIES.useIsOutOfDeployCredit = () => input.isOutOfCredit ?? false;
    const flags: Partial<Record<Parameters<typeof DEPENDENCIES.useFlag>[0], boolean>> = {
      hackathons: isHackathonsEnabled,
      onboarding_intent_first: input.isIntentFirst ?? false
    };
    const useFlag: typeof DEPENDENCIES.useFlag = flag => flags[flag] ?? false;
    const analyticsService = mock<AnalyticsService>();
    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        publicConfig: { NEXT_PUBLIC_TRIAL_CREDITS_AMOUNT: trialCreditsAmount },
        urlService: UrlService,
        analyticsService
      });

    const result = render(
      <OnboardingPickerPage
        dependencies={MockComponents(DEPENDENCIES, {
          useRouter,
          useSearchParams,
          useEnsureTrialStarted,
          useIsOutOfDeployCredit,
          useMarkAutoDeployStart: () => markAutoDeployStart,
          useWallet,
          useFlag,
          useServices,
          ...input.dependencies
        })}
      />
    );

    return { ...result, analyticsService, markAutoDeployStart };
  }
});
