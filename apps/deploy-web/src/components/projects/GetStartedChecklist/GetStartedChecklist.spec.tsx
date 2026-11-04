import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AI_AGENTS_DOCS_URL, AKASH_SKILL_INSTALL_COMMAND, AKT_DOCS_URL, API_REFERENCE_URL } from "@src/config/agent-setup.config";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { UrlService } from "@src/utils/urlUtils";
import {
  AKASHML_MODELS,
  AKASHML_URL,
  AKT_CONTEXT_COMMAND,
  AKT_DEPLOY_COMMAND,
  AKT_INSTALL_COMMAND,
  DEPENDENCIES,
  DEPLOY_PROMPT,
  GetStartedChecklist,
  LIST_DEPLOYMENTS_COMMAND
} from "./GetStartedChecklist";
import type { GetStartedSteps } from "./useGetStartedChecklist";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(GetStartedChecklist.name, () => {
  it("renders nothing while the checklist is hidden", () => {
    const { container } = setup({ isVisible: false });

    expect(container).toBeEmptyDOMElement();
  });

  it("stays on screen while a newly created key has not been copied yet", async () => {
    setup({ isVisible: false, createdApiKey: { name: "Onboarding key", apiKey: "ac.sk.secret-key-value" } });
    await userEvent.click(screen.getByRole("button", { name: "Set up your tools" }));

    await userEvent.click(screen.getByRole("button", { name: "Copy skill install command" }));

    expect(screen.getByText("“Onboarding key” is shown once. Copy it now.")).toBeInTheDocument();
  });

  it("hides once the newly created key is copied", async () => {
    const { container } = setup({ isVisible: false, createdApiKey: { name: "Onboarding key", apiKey: "ac.sk.secret-key-value" } });
    await userEvent.click(screen.getByRole("button", { name: "Set up your tools" }));

    await userEvent.click(screen.getByRole("button", { name: "Copy API key command" }));

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the newly created key on screen when copying it fails", async () => {
    setup({ isVisible: false, isCopySuccessful: false, createdApiKey: { name: "Onboarding key", apiKey: "ac.sk.secret-key-value" } });
    await userEvent.click(screen.getByRole("button", { name: "Set up your tools" }));

    await userEvent.click(screen.getByRole("button", { name: "Copy API key command" }));

    expect(screen.getByText("“Onboarding key” is shown once. Copy it now.")).toBeInTheDocument();
  });

  it("hides on dismiss even while a newly created key has not been copied", async () => {
    const { container, dismiss } = setup({ isVisible: false, createdApiKey: { name: "Onboarding key", apiKey: "ac.sk.secret-key-value" } });

    await userEvent.click(screen.getByRole("button", { name: "Dismiss Get started" }));

    expect(dismiss).toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("introduces the two steps with the progress so far", () => {
    setup({ steps: { hasDeployed: true }, doneCount: 1 });

    expect(screen.getByRole("heading", { name: "Get started" })).toBeInTheDocument();
    expect(screen.getByText("1 of 2 done")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Deploy your first app" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create an API key and connect your tools" })).toBeInTheDocument();
    expect(screen.getByText("Your first app is live. Deploy another any time.")).toBeInTheDocument();
    expect(screen.getAllByText("Done:")).toHaveLength(1);
  });

  it("says the account is set up once every step is done", () => {
    setup({ isComplete: true, steps: { hasDeployed: true }, hasSetUpTools: true, doneCount: 2 });

    expect(screen.getByRole("heading", { name: "You're set up" })).toBeInTheDocument();
    expect(screen.getByText("Your key is set up. Deploy from your agent, the CLI or the API.")).toBeInTheDocument();
    expect(screen.getAllByText("Done:")).toHaveLength(2);
  });

  it("dismisses from the Dismiss link", async () => {
    const { dismiss } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Dismiss Get started" }));

    expect(dismiss).toHaveBeenCalled();
  });

  it("deploys the first quick pick through the one-click configure flow and tracks it", async () => {
    const { push, markAutoDeployStart, analyticsService } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Deploy Hello world" }));

    expect(analyticsService.track).toHaveBeenCalledWith("get_started_step_click", { category: "onboarding", step: "deploy", option: "hello-world" });
    expect(markAutoDeployStart).toHaveBeenCalledWith("hello-world");
    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: "hello-world", sdlStrategy: "default", bidStrategy: "auto" }));
  });

  it("leaves the quick deploy out when no template fits the trial", () => {
    setup({ quickPicks: [] });

    expect(screen.queryByRole("button", { name: /^Deploy / })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your image" })).toBeInTheDocument();
  });

  it("starts from the user's own image and tracks it", async () => {
    const { analyticsService } = setup();
    const link = screen.getByRole("link", { name: "Your image" });
    link.addEventListener("click", event => event.preventDefault());

    await userEvent.click(link);

    expect(link).toHaveAttribute("href", UrlService.configureDeployment({ exampleImage: true }));
    expect(analyticsService.track).toHaveBeenCalledWith("get_started_step_click", { category: "onboarding", step: "deploy", option: "custom-image" });
  });

  it.each([
    { case: "the deploy step while nothing is done", steps: {}, hasSetUpTools: false, primary: "Deploy Hello world", secondary: "Set up your tools" },
    {
      case: "the tools step once the user deployed",
      steps: { hasDeployed: true },
      hasSetUpTools: false,
      primary: "Set up your tools",
      secondary: "Deploy Hello world"
    }
  ])("highlights $case", ({ steps, hasSetUpTools, primary, secondary }) => {
    setup({ steps, hasSetUpTools });

    expect(screen.getByRole("button", { name: primary })).toHaveClass("bg-primary");
    expect(screen.getByRole("button", { name: secondary })).not.toHaveClass("bg-primary");
  });

  it("keeps the tools setup closed until asked, then opens it on the agent tab and tracks it", async () => {
    const { analyticsService, useOnboardingApiKey } = setup();

    expect(screen.queryByRole("tablist", { name: "How you'll deploy" })).not.toBeInTheDocument();
    expect(useOnboardingApiKey).toHaveBeenLastCalledWith({ enabled: false });

    await userEvent.click(screen.getByRole("button", { name: "Set up your tools" }));

    expect(screen.getByRole("button", { name: "Set up your tools" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("tab", { name: "Agent" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Install the Akash skill" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Setup guide" })).toHaveAttribute("href", AI_AGENTS_DOCS_URL);
    expect(useOnboardingApiKey).toHaveBeenLastCalledWith({ enabled: true });
    expect(analyticsService.track).toHaveBeenCalledWith("get_started_step_click", { category: "onboarding", step: "agent", option: "open_tools" });

    await userEvent.click(screen.getByRole("button", { name: "Set up your tools" }));

    expect(screen.queryByRole("tablist", { name: "How you'll deploy" })).not.toBeInTheDocument();
    expect(analyticsService.track).toHaveBeenCalledTimes(1);
  });

  it("doesn't look up the trial project for a hidden checklist", () => {
    const { useOnboardingApiKey } = setup({ isVisible: false });

    expect(useOnboardingApiKey).toHaveBeenLastCalledWith({ enabled: false });
  });

  it("shows the akt CLI and REST API setups on their tabs", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Set up your tools" }));

    await userEvent.click(screen.getByRole("tab", { name: "akt CLI" }));
    expect(screen.getByTitle(AKT_INSTALL_COMMAND)).toBeInTheDocument();
    expect(screen.getByTitle(AKT_CONTEXT_COMMAND)).toBeInTheDocument();
    expect(screen.getByTitle(AKT_DEPLOY_COMMAND)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "akt docs" })).toHaveAttribute("href", AKT_DOCS_URL);

    await userEvent.click(screen.getByRole("tab", { name: "REST API" }));
    expect(screen.getByTitle(LIST_DEPLOYMENTS_COMMAND)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "API reference" })).toHaveAttribute("href", API_REFERENCE_URL);
  });

  it("creates the API key inline and tracks it", async () => {
    const { analyticsService, createApiKey } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Set up your tools" }));

    await userEvent.click(screen.getByRole("button", { name: "Create API key" }));

    expect(createApiKey).toHaveBeenCalled();
    expect(analyticsService.track).toHaveBeenCalledWith("get_started_step_click", { category: "onboarding", step: "api_key", option: "create_key" });
  });

  it.each([{ isCreating: true }, { isLoadingTrialProject: true }])("holds the key creation while it can't run yet: %o", async input => {
    setup(input);
    await userEvent.click(screen.getByRole("button", { name: "Set up your tools" }));

    expect(screen.getByRole("button", { name: "Creating key…" })).toBeDisabled();
  });

  it("mentions an existing key only to a user who has one", async () => {
    setup({ steps: { hasApiKey: true } });
    await userEvent.click(screen.getByRole("button", { name: "Set up your tools" }));

    expect(screen.getByText("Or use a key you already have.")).toBeInTheDocument();
  });

  it("leaves the existing key note out for a user without a key", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Set up your tools" }));

    expect(screen.queryByText("Or use a key you already have.")).not.toBeInTheDocument();
  });

  it.each([
    { tab: "Agent", line: 'export AKASH_API_KEY="ac.sk.secret-key-value"', shown: 'export AKASH_API_KEY="ac.sk.secret…"' },
    { tab: "akt CLI", line: "akt console login ac.sk.secret-key-value", shown: "akt console login ac.sk.secret…" },
    { tab: "REST API", line: 'export AKASH_API_KEY="ac.sk.secret-key-value"', shown: 'export AKASH_API_KEY="ac.sk.secret…"' }
  ])("fills the created key into the $tab setup, shortened on screen and shown once", async ({ tab, line, shown }) => {
    const { writeText } = setup({ createdApiKey: { name: "Onboarding key", apiKey: "ac.sk.secret-key-value" } });
    await userEvent.click(screen.getByRole("button", { name: "Set up your tools" }));
    await userEvent.click(screen.getByRole("tab", { name: tab }));

    expect(screen.getByText(shown)).toBeInTheDocument();
    expect(screen.getByText("“Onboarding key” is shown once. Copy it now.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Copy API key command" }));

    expect(writeText).toHaveBeenCalledWith(line);
  });

  it.each([
    { tab: "Agent", label: "Copy skill install command", text: AKASH_SKILL_INSTALL_COMMAND, option: "copy_agent" },
    { tab: "Agent", label: "Copy deploy prompt", text: DEPLOY_PROMPT, option: "copy_agent" },
    { tab: "akt CLI", label: "Copy akt install command", text: AKT_INSTALL_COMMAND, option: "copy_akt" },
    { tab: "akt CLI", label: "Copy akt context command", text: AKT_CONTEXT_COMMAND, option: "copy_akt" },
    { tab: "akt CLI", label: "Copy akt deploy command", text: AKT_DEPLOY_COMMAND, option: "copy_akt" },
    { tab: "REST API", label: "Copy list deployments command", text: LIST_DEPLOYMENTS_COMMAND, option: "copy_rest" }
  ])("copies with $label on the $tab tab, records the copy and confirms it", async ({ tab, label, text, option }) => {
    const { analyticsService, writeText, markAgentSetupCopied } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Set up your tools" }));
    await userEvent.click(screen.getByRole("tab", { name: tab }));

    await userEvent.click(screen.getByRole("button", { name: label }));

    expect(writeText).toHaveBeenCalledWith(text);
    expect(markAgentSetupCopied).toHaveBeenCalled();
    expect(analyticsService.track).toHaveBeenCalledWith("get_started_step_click", { category: "onboarding", step: "agent", option });
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("goes back to the copy label after a moment", async () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Set up your tools" }));

    fireEvent.click(screen.getByRole("button", { name: "Copy skill install command" }));
    await act(() => vi.advanceTimersByTimeAsync(1499));
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1));

    expect(screen.getByRole("button", { name: "Copy skill install command" })).toBeInTheDocument();
  });

  it("leaves the tools step open when the copy fails", async () => {
    const { markAgentSetupCopied } = setup({ isCopySuccessful: false });
    await userEvent.click(screen.getByRole("button", { name: "Set up your tools" }));

    await userEvent.click(screen.getByRole("button", { name: "Copy skill install command" }));

    expect(markAgentSetupCopied).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Copied" })).not.toBeInTheDocument();
  });

  it("promotes AkashML for bigger models with its models, in a new tab, and tracks the click", async () => {
    const { analyticsService } = setup();
    const promo = screen.getByRole("complementary", { name: "Need a bigger model? Call it as an API." });
    const link = within(promo).getByRole("link", { name: "Try AkashML" });
    link.addEventListener("click", event => event.preventDefault());

    await userEvent.click(link);

    expect(
      within(promo)
        .getAllByRole("listitem")
        .map(item => item.textContent)
    ).toEqual(AKASHML_MODELS);
    expect(link).toHaveAttribute("href", AKASHML_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(AKASHML_URL).toBe("https://playground.akashml.com/?utm_source=akash-console&utm_medium=get-started&utm_campaign=trial-onboarding");
    expect(analyticsService.track).toHaveBeenCalledWith("akashml_link_click", { category: "onboarding", placement: "get_started" });
  });

  function setup(
    input: {
      isVisible?: boolean;
      isComplete?: boolean;
      steps?: Partial<GetStartedSteps>;
      hasSetUpTools?: boolean;
      doneCount?: number;
      isCopySuccessful?: boolean;
      quickPicks?: { templateId: string; label: string }[];
      createdApiKey?: { name: string; apiKey: string };
      isCreating?: boolean;
      isLoadingTrialProject?: boolean;
    } = {}
  ) {
    const push = vi.fn();
    const markAutoDeployStart = vi.fn();
    const dismiss = vi.fn();
    const markAgentSetupCopied = vi.fn();
    const createApiKey = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const writeText = input.isCopySuccessful === false ? vi.fn().mockRejectedValue(new Error("denied")) : vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const steps: GetStartedSteps = { hasDeployed: false, hasApiKey: false, hasConnectedAgent: false, ...input.steps };
    const useOnboardingApiKey = vi.fn<typeof DEPENDENCIES.useOnboardingApiKey>(() =>
      mock<ReturnType<typeof DEPENDENCIES.useOnboardingApiKey>>({
        createApiKey,
        createdApiKey: input.createdApiKey
          ? mock<NonNullable<ReturnType<typeof DEPENDENCIES.useOnboardingApiKey>["createdApiKey"]>>(input.createdApiKey)
          : undefined,
        isCreating: input.isCreating ?? false,
        isLoadingTrialProject: input.isLoadingTrialProject ?? false
      })
    );

    const dependencies = MockComponents(DEPENDENCIES, {
      useGetStartedChecklist: () => ({
        isVisible: input.isVisible ?? true,
        steps,
        hasSetUpTools: input.hasSetUpTools ?? false,
        doneCount: input.doneCount ?? 0,
        stepCount: 2,
        isComplete: input.isComplete ?? false,
        dismiss,
        markAgentSetupCopied
      }),
      useOnboardingApiKey,
      useRouter: () => mock<AppRouterInstance>({ push }),
      useMarkAutoDeployStart: () => markAutoDeployStart,
      useServices: () =>
        mock<ReturnType<typeof DEPENDENCIES.useServices>>({
          urlService: UrlService,
          analyticsService
        }),
      useGetStartedQuickPicks: () =>
        input.quickPicks ?? [
          { templateId: "hello-world", label: "Hello world" },
          { templateId: "akash-network-awesome-akash-Space-Agent", label: "Space Agent" }
        ]
    });

    const { container } = render(<GetStartedChecklist dependencies={dependencies} />);

    return { container, push, markAutoDeployStart, dismiss, markAgentSetupCopied, createApiKey, analyticsService, writeText, useOnboardingApiKey };
  }
});
