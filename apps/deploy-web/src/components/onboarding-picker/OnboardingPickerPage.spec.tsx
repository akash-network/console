import type { ApiManagedWalletOutput } from "@akashnetwork/http-sdk";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { EnsureTrialStartedResult } from "@src/hooks/useEnsureTrialStarted";
import { UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, OnboardingPickerPage } from "./OnboardingPickerPage";

import { act, render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

const HELLO_WORLD_ID = "hello-world";
const SPACE_AGENT_ID = "akash-network-awesome-akash-Space-Agent";
const LLM_ID = "akash-network-awesome-akash-Llama-3.1-8B";

type PickerCardProps = Parameters<typeof DEPENDENCIES.DeploymentTemplatePickerCard>[0];
type SheetProps = Parameters<typeof DEPENDENCIES.AddCreditsSheet>[0];
type ButtonProps = Parameters<typeof DEPENDENCIES.Button>[0];

describe(OnboardingPickerPage.name, () => {
  it("renders a card per template", () => {
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ dependencies: { DeploymentTemplatePickerCard } });

    const titles = DeploymentTemplatePickerCard.mock.calls.map(call => (call[0] as PickerCardProps).title);
    expect(titles).toEqual(["Hello world", "Space Agent", "LLM Chatbot"]);
  });

  it("renders the account menu in its minimal variant", () => {
    // AccountMenu's optional-props signature isn't assignable from the generic ComponentMock, so cast the override only.
    const AccountMenu = vi.fn(ComponentMock);
    setup({ dependencies: { AccountMenu: AccountMenu as unknown as typeof DEPENDENCIES.AccountMenu } });

    expect((AccountMenu.mock.calls.at(-1)![0] as { minimal?: boolean }).minimal).toBe(true);
  });

  it("renders the trial credit amount from public config", () => {
    setup({ trialCreditsAmount: 1 });

    expect(screen.getByText("$1 in free trial credits")).toBeInTheDocument();
  });

  it("renders the first-purchase bonus offer when the first_purchase_bonus flag is on", () => {
    const { container } = setup({ isFirstPurchaseBonusEnabled: true });

    expect(container).toHaveTextContent("Plus, get 10% in bonus credits on your first purchase, up to $100.");
  });

  it("hides the first-purchase bonus offer when the first_purchase_bonus flag is off", () => {
    const { container } = setup({ isFirstPurchaseBonusEnabled: false });

    expect(container).not.toHaveTextContent("bonus credits");
  });

  it("redirects to the configure view with the hello-world auto-deploy intent when its card deploys", () => {
    const push = vi.fn();
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ push, dependencies: { DeploymentTemplatePickerCard } });

    act(() => getCard(DeploymentTemplatePickerCard, "Hello world").onDeploy!());

    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: HELLO_WORLD_ID, sdlStrategy: "default", bidStrategy: "auto" }));
  });

  it("redirects to the configure view with the space-agent auto-deploy intent when its card deploys", () => {
    const push = vi.fn();
    const DeploymentTemplatePickerCard = vi.fn(ComponentMock);
    setup({ push, dependencies: { DeploymentTemplatePickerCard } });

    act(() => getCard(DeploymentTemplatePickerCard, "Space Agent").onDeploy!());

    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: SPACE_AGENT_ID, sdlStrategy: "default", bidStrategy: "auto" }));
  });

  it("renders an error alert when trial start fails terminally", () => {
    const useEnsureTrialStarted: () => EnsureTrialStartedResult = () =>
      mock<EnsureTrialStartedResult>({ wallet: undefined, isWalletReady: false, isLoading: false, error: new Error("boom") });
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
        useEnsureTrialStarted: () => mock<EnsureTrialStartedResult>({ wallet: undefined, isWalletReady: false, isLoading: true, error: null })
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

  it("forwards isWalletReady to the verification sheet", () => {
    const AddCreditsSheet = vi.fn(ComponentMock);
    setup({
      isTrialing: true,
      dependencies: {
        AddCreditsSheet,
        useEnsureTrialStarted: () => mock<EnsureTrialStartedResult>({ wallet: undefined, isWalletReady: false, isLoading: true, error: null })
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
    act(() => (AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps).onDone(100, "Acme"));

    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: LLM_ID, sdlStrategy: "default", bidStrategy: "auto" }));
  });

  it("renders a button to skip the trial and unlock Console while trialing", () => {
    setup({ isTrialing: true, wallet: mock<ApiManagedWalletOutput>({ creditAmount: 100 }) });

    expect(screen.getByText(/Skip the trial - unlock Console/i)).toBeInTheDocument();
  });

  it("hides the skip-the-trial button once the user is no longer trialing and the wallet is funded", () => {
    setup({ isTrialing: false, wallet: mock<ApiManagedWalletOutput>({ creditAmount: 100 }) });

    expect(screen.queryByText(/Skip the trial - unlock Console/i)).not.toBeInTheDocument();
  });

  it("renders the skip-the-trial button when the wallet has no credit even after the trial has ended", () => {
    setup({ isTrialing: false, wallet: mock<ApiManagedWalletOutput>({ creditAmount: 0 }) });

    expect(screen.getByText(/Skip the trial - unlock Console/i)).toBeInTheDocument();
  });

  it("renders the skip-the-trial button when no wallet exists yet and the trial has ended", () => {
    setup({ isTrialing: false, wallet: undefined });

    expect(screen.getByText(/Skip the trial - unlock Console/i)).toBeInTheDocument();
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
      isFirstPurchaseBonusEnabled?: boolean;
      trialCreditsAmount?: number;
      wallet?: EnsureTrialStartedResult["wallet"];
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const push = input.push ?? vi.fn();
    const replace = input.replace ?? vi.fn();
    const isTrialing = input.isTrialing ?? true;
    const isHackathonsEnabled = input.isHackathonsEnabled ?? false;
    const isFirstPurchaseBonusEnabled = input.isFirstPurchaseBonusEnabled ?? false;
    const trialCreditsAmount = input.trialCreditsAmount ?? 100;
    const wallet = "wallet" in input ? input.wallet : mock<ApiManagedWalletOutput>({ creditAmount: 100 });

    const useRouter: typeof DEPENDENCIES.useRouter = vi.fn(() => mock<AppRouterInstance>({ push, replace }));
    const useSearchParams: typeof DEPENDENCIES.useSearchParams = () => new URLSearchParams(input.searchParams ?? "") as ReadonlyURLSearchParams;
    const useEnsureTrialStarted: typeof DEPENDENCIES.useEnsureTrialStarted = vi.fn(() =>
      mock<EnsureTrialStartedResult>({
        wallet,
        isWalletReady: true,
        isLoading: false,
        error: null
      })
    );
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing });
    const useFlag: typeof DEPENDENCIES.useFlag = flag => (flag === "first_purchase_bonus" ? isFirstPurchaseBonusEnabled : isHackathonsEnabled);
    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({ publicConfig: { NEXT_PUBLIC_TRIAL_CREDITS_AMOUNT: trialCreditsAmount }, urlService: UrlService });

    return render(
      <OnboardingPickerPage
        dependencies={MockComponents(DEPENDENCIES, {
          useRouter,
          useSearchParams,
          useEnsureTrialStarted,
          useWallet,
          useFlag,
          useServices,
          ...input.dependencies
        })}
      />
    );
  }
});
