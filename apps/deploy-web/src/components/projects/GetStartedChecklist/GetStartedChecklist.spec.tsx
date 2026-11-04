import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AKASH_SKILL_INSTALL_COMMAND } from "@src/config/agent-setup.config";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { UrlService } from "@src/utils/urlUtils";
import { AKASHML_URL, API_KEY_SETUP_COMMAND, DEPENDENCIES, GetStartedChecklist } from "./GetStartedChecklist";
import type { GetStartedSteps } from "./useGetStartedChecklist";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(GetStartedChecklist.name, () => {
  it("renders nothing while the checklist is hidden", () => {
    const { container } = setup({ isVisible: false });

    expect(container).toBeEmptyDOMElement();
  });

  it("introduces the three steps with the progress so far", () => {
    setup({ steps: { hasDeployed: true } });

    expect(screen.getByRole("heading", { name: "Get started on Akash" })).toBeInTheDocument();
    expect(screen.getByText("Stays on your home page until you finish or dismiss it.")).toBeInTheDocument();
    expect(screen.getByText("1 of 3 done")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Deploy your first app" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create an API key" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Connect your agent" })).toBeInTheDocument();
    expect(screen.getAllByText("Done:")).toHaveLength(1);
  });

  it("says the account is set up once every step is done", () => {
    setup({ isComplete: true, steps: { hasDeployed: true, hasApiKey: true, hasConnectedAgent: true } });

    expect(screen.getByRole("heading", { name: "You're set up" })).toBeInTheDocument();
    expect(screen.getByText("All three steps are done. This card goes away in a moment.")).toBeInTheDocument();
    expect(screen.getAllByText("Done:")).toHaveLength(3);
  });

  it("dismisses from the close button", async () => {
    const { dismiss } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Dismiss Get started" }));

    expect(dismiss).toHaveBeenCalled();
  });

  it("offers each quick pick that fits the trial", () => {
    setup();

    expect(screen.getByRole("button", { name: "Hello world" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Space Agent" })).toBeInTheDocument();
  });

  it("deploys a quick pick through the one-click configure flow and tracks it", async () => {
    const { push, analyticsService } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Hello world" }));

    expect(analyticsService.track).toHaveBeenCalledWith("get_started_step_click", { category: "onboarding", step: "deploy", option: "hello-world" });
    expect(push).toHaveBeenCalledWith(UrlService.configureDeployment({ templateId: "hello-world", sdlStrategy: "default", bidStrategy: "auto" }));
  });

  it("starts from the user's own image and tracks it", async () => {
    const { analyticsService } = setup();
    const link = screen.getByRole("link", { name: "Your image" });
    link.addEventListener("click", event => event.preventDefault());

    await userEvent.click(link);

    expect(link).toHaveAttribute("href", UrlService.configureDeployment({ exampleImage: true }));
    expect(analyticsService.track).toHaveBeenCalledWith("get_started_step_click", { category: "onboarding", step: "deploy", option: "custom-image" });
  });

  it("opens the API key dialog and closes it again", async () => {
    const { analyticsService, CreateApiKeyDialog } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Create key" }));

    expect(analyticsService.track).toHaveBeenCalledWith("get_started_step_click", { category: "onboarding", step: "api_key", option: "create_key" });
    expect(screen.getByRole("dialog", { name: "create key" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "close dialog" }));

    expect(screen.queryByRole("dialog", { name: "create key" })).not.toBeInTheDocument();
    expect(CreateApiKeyDialog).toHaveBeenCalled();
  });

  it("points to the existing keys once the user has one", async () => {
    const { analyticsService } = setup({ steps: { hasApiKey: true } });
    const link = screen.getByRole("link", { name: "Manage keys" });
    link.addEventListener("click", event => event.preventDefault());

    await userEvent.click(link);

    expect(link).toHaveAttribute("href", UrlService.userApiKeys());
    expect(screen.queryByRole("button", { name: "Create key" })).not.toBeInTheDocument();
    expect(analyticsService.track).toHaveBeenCalledWith("get_started_step_click", { category: "onboarding", step: "api_key", option: "manage_keys" });
  });

  it("holds the key setup until the user has a key", () => {
    setup();

    expect(screen.getByRole("button", { name: "Copy key setup" })).toBeDisabled();
    expect(screen.getByText("Key setup uses the key from step 2.")).toBeInTheDocument();
  });

  it("allows the key setup once the user has a key", () => {
    setup({ steps: { hasApiKey: true } });

    expect(screen.getByRole("button", { name: "Copy key setup" })).toBeEnabled();
    expect(screen.queryByText("Key setup uses the key from step 2.")).not.toBeInTheDocument();
  });

  it.each([
    { label: "Copy install", option: "copy_install", text: AKASH_SKILL_INSTALL_COMMAND },
    { label: "Copy key setup", option: "copy_key_setup", text: API_KEY_SETUP_COMMAND }
  ])("copies with $label, checks the agent step and confirms the copy", async ({ label, option, text }) => {
    const { analyticsService, writeText, markAgentSetupCopied } = setup({ steps: { hasApiKey: true } });

    await userEvent.click(screen.getByRole("button", { name: label }));

    expect(writeText).toHaveBeenCalledWith(text);
    expect(markAgentSetupCopied).toHaveBeenCalled();
    expect(analyticsService.track).toHaveBeenCalledWith("get_started_step_click", { category: "onboarding", step: "agent", option });
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("goes back to the copy label after a moment", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "Copy install" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Copy install" })).toBeInTheDocument(), { timeout: 3000 });
  });

  it("leaves the agent step open when the copy fails", async () => {
    const { markAgentSetupCopied } = setup({ isCopySuccessful: false });

    await userEvent.click(screen.getByRole("button", { name: "Copy install" }));

    expect(markAgentSetupCopied).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Copied" })).not.toBeInTheDocument();
  });

  it("points to AkashML for bigger models in a new tab and tracks the click", async () => {
    const { analyticsService } = setup();
    const link = screen.getByRole("link", { name: "Try AkashML" });
    link.addEventListener("click", event => event.preventDefault());

    await userEvent.click(link);

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
      isCopySuccessful?: boolean;
    } = {}
  ) {
    const push = vi.fn();
    const dismiss = vi.fn();
    const markAgentSetupCopied = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const writeText = input.isCopySuccessful === false ? vi.fn().mockRejectedValue(new Error("denied")) : vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const steps: GetStartedSteps = { hasDeployed: false, hasApiKey: false, hasConnectedAgent: false, ...input.steps };
    const CreateApiKeyDialog = vi.fn<typeof DEPENDENCIES.CreateApiKeyDialog>(({ onClose }) => (
      <div role="dialog" aria-label="create key">
        <button type="button" onClick={onClose}>
          close dialog
        </button>
      </div>
    ));

    const dependencies = MockComponents(DEPENDENCIES, {
      useGetStartedChecklist: () => ({
        isVisible: input.isVisible ?? true,
        steps,
        doneCount: Object.values(steps).filter(Boolean).length,
        stepCount: 3,
        isComplete: input.isComplete ?? false,
        dismiss,
        markAgentSetupCopied
      }),
      useRouter: () => mock<AppRouterInstance>({ push }),
      useServices: () =>
        mock<ReturnType<typeof DEPENDENCIES.useServices>>({
          publicConfig: {
            NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_CPU: 4,
            NEXT_PUBLIC_MANAGED_WALLET_TRIAL_MAX_MEMORY_GI: 16,
            NEXT_PUBLIC_MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: ["nvidia/h100"]
          },
          urlService: UrlService,
          analyticsService
        }),
      useGetStartedQuickPicks: () => [
        { templateId: "hello-world", label: "Hello world" },
        { templateId: "akash-network-awesome-akash-Space-Agent", label: "Space Agent" }
      ],
      CreateApiKeyDialog
    });

    const { container } = render(<GetStartedChecklist dependencies={dependencies} />);

    return { container, push, dismiss, markAgentSetupCopied, analyticsService, writeText, CreateApiKeyDialog };
  }
});
