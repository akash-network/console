import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationRole } from "@src/types/organization";
import { UrlService } from "@src/utils/urlUtils";
import type { ResumeResolution } from "../ResumeDeploymentGuard/ResumeDeploymentGuard";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./AutoDeployFlow";
import { AutoDeployFlow } from "./AutoDeployFlow";

import { render, screen } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";

type SceneProps = Parameters<typeof DEPENDENCIES.PhasedDeployProgressScene>[0];
type FlowResult = ReturnType<typeof DEPENDENCIES.useAutoDeploymentFlow>;

const CONTACT_SUPPORT_URL = "https://akash.network/discord";

describe(AutoDeployFlow.name, () => {
  it("drives the autopilot with the shared flow and the resolved SDL", () => {
    const useAutoDeploymentFlow = vi.fn(() => buildAutopilot());
    const flow = buildFlow();
    setup({ sdl: "sdl-content", flow, useAutoDeploymentFlow });

    expect(useAutoDeploymentFlow).toHaveBeenCalledWith({ sdl: "sdl-content", resumeLeases: [], flow });
  });

  it("forwards the guard's resolved live leases to the flow so it can re-send the manifest", () => {
    const useAutoDeploymentFlow = vi.fn(() => buildAutopilot());
    const activeLeases = [{ dseq: "555", gseq: 1, oseq: 2, provider: "akash1provider" }];
    setup({ resume: { activeLeases }, useAutoDeploymentFlow });

    expect(useAutoDeploymentFlow).toHaveBeenCalledWith(expect.objectContaining({ resumeLeases: activeLeases }));
  });

  it("passes the flow state and template name through to the progress scene", () => {
    const PhasedDeployProgressScene = vi.fn(ComponentMock);
    setup({
      templateName: "my-app",
      autopilot: { state: { kind: "matching" }, progressPercent: 42 },
      dependencies: { PhasedDeployProgressScene }
    });

    expect(PhasedDeployProgressScene).toHaveBeenCalledWith(
      expect.objectContaining({ state: { kind: "matching" }, templateName: "my-app", progressPercent: 42 }),
      expect.anything()
    );
  });

  it("focuses the scene on the matched provider address", () => {
    const PhasedDeployProgressScene = vi.fn(ComponentMock);
    setup({ autopilot: { matchedProviderAddress: "akash1provider" }, dependencies: { PhasedDeployProgressScene } });

    expect(PhasedDeployProgressScene).toHaveBeenCalledWith(expect.objectContaining({ focusedProviderAddress: "akash1provider" }), expect.anything());
  });

  it("takes an owner to the project whose budget refused the deployment", () => {
    const { push, sceneProps } = setup({ autopilot: { state: { kind: "error", reason: "budget-exceeded", projectId: "storefront" } } });

    sceneProps().onViewProject?.();

    expect(push).toHaveBeenCalledWith(UrlService.project("storefront"));
  });

  it("offers no way to the project to those who cannot change its budget", () => {
    const { sceneProps } = setup({
      organizationRole: "member",
      autopilot: { state: { kind: "error", reason: "budget-exceeded", projectId: "storefront" } }
    });

    expect(sceneProps().onViewProject).toBeUndefined();
  });

  it("offers no way to the project while the organization does not work in projects", () => {
    const { sceneProps } = setup({
      projectsEnabled: false,
      autopilot: { state: { kind: "error", reason: "budget-exceeded", projectId: "storefront" } }
    });

    expect(sceneProps().onViewProject).toBeUndefined();
  });

  it("offers no way to a project for a budget refusal that names none, or for any other failure", () => {
    expect(setup({ autopilot: { state: { kind: "error", reason: "budget-exceeded" } } }).sceneProps().onViewProject).toBeUndefined();
    expect(setup({ autopilot: { state: { kind: "error", reason: "needs-funds", projectId: "storefront" } } }).sceneProps().onViewProject).toBeUndefined();
    expect(setup({ autopilot: { state: { kind: "matching" } } }).sceneProps().onViewProject).toBeUndefined();
  });

  it("asks the flow to try again when the scene requests it", () => {
    const tryAgain = vi.fn();
    const { sceneProps } = setup({ autopilot: { tryAgain } });

    sceneProps().onTryAgain?.();

    expect(tryAgain).toHaveBeenCalledTimes(1);
  });

  it("opens add credits in place when the scene asks to add funds", () => {
    const { sceneProps, openAddCredits } = setup({ templateName: "Hello World" });

    sceneProps().onAddFunds?.();

    expect(openAddCredits).toHaveBeenCalledWith({
      initialTab: "purchase",
      description: "Add credits to your balance to deploy Hello World.",
      context: "auto_deploy_needs_funds",
      nextStepLabel: "Continue to deploy",
      onCreditsAdded: expect.any(Function)
    });
  });

  it("tries again on its own once credits land, so the user is not left on the error scene", () => {
    const tryAgain = vi.fn();
    const { sceneProps, creditsAddedCallback, analyticsService } = setup({ autopilot: { tryAgain, state: { kind: "error", reason: "needs-funds" } } });
    sceneProps().onAddFunds?.();

    creditsAddedCallback()();

    expect(tryAgain).toHaveBeenCalledTimes(1);
    expect(analyticsService.track).toHaveBeenCalledWith("add_credits_resumed_deploy", { category: "billing", context: "auto_deploy_needs_funds" });
  });

  it("leaves a deploy refused for another reason alone when credits land", () => {
    const tryAgain = vi.fn();
    const { sceneProps, creditsAddedCallback } = setup({ autopilot: { tryAgain, state: { kind: "error", reason: "top-up-pending" } } });
    sceneProps().onAddFunds?.();

    creditsAddedCallback()();

    expect(tryAgain).not.toHaveBeenCalled();
  });

  it("leaves a deploy that is no longer failing alone when credits land", () => {
    const tryAgain = vi.fn();
    const { sceneProps, creditsAddedCallback } = setup({ autopilot: { tryAgain, state: { kind: "matching" } } });
    sceneProps().onAddFunds?.();

    creditsAddedCallback()();

    expect(tryAgain).not.toHaveBeenCalled();
  });

  it("stops the autopilot and switches to manual bid selection with the recommended bids when the user chooses a provider", () => {
    const stopAutopilot = vi.fn();
    const setBidStrategy = vi.fn();
    const flow = buildFlow({ actions: mock<DeploymentFlow["actions"]>({ setBidStrategy }) });
    const { sceneProps } = setup({ flow, autopilot: { stopAutopilot, recommendedBidIds: ["akash1provider/12345/1/1"] } });

    sceneProps().onChooseProvider?.();

    expect(stopAutopilot).toHaveBeenCalledTimes(1);
    expect(setBidStrategy).toHaveBeenCalledWith("select", ["akash1provider/12345/1/1"]);
  });

  it("stops the autopilot and switches to manual bid selection when the user tries another provider after a failed lease", () => {
    const stopAutopilot = vi.fn();
    const setBidStrategy = vi.fn();
    const flow = buildFlow({ actions: mock<DeploymentFlow["actions"]>({ setBidStrategy }) });
    const { sceneProps, analyticsService } = setup({ flow, autopilot: { stopAutopilot, state: { kind: "error", reason: "lease-failed" } } });

    sceneProps().onTryAnotherProvider?.();

    expect(stopAutopilot).toHaveBeenCalledTimes(1);
    expect(setBidStrategy).toHaveBeenCalledWith("select", []);
    expect(analyticsService.track).not.toHaveBeenCalledWith("onboarding_choose_provider_click", expect.anything());
  });

  it("tracks the choose-provider click with the template name, deployment and bid count when the user switches to manual selection", () => {
    const flow = buildFlow({
      dseq: "12345",
      bids: [mock<DeploymentFlow["bids"][number]>(), mock<DeploymentFlow["bids"][number]>()],
      actions: mock<DeploymentFlow["actions"]>({ setBidStrategy: vi.fn() })
    });
    const { sceneProps, analyticsService } = setup({ flow, templateName: "my-app" });

    sceneProps().onChooseProvider?.();

    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_choose_provider_click", {
      category: "onboarding",
      templateName: "my-app",
      dseq: "12345",
      numberOfBids: 2
    });
  });

  it("opens the configured contact-support URL when the scene requests support", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const { sceneProps } = setup({ contactSupportUrl: "https://support.example" });

    sceneProps().onContactSupport?.();

    expect(open).toHaveBeenCalledWith("https://support.example", "_blank", "noopener,noreferrer");
  });

  describe("while the api takes a one-click deploy on", () => {
    it("shows only that the deployment is starting while the create awaits the api's answer", () => {
      const PhasedDeployProgressScene = vi.fn(ComponentMock);
      setup({ autopilot: { state: { kind: "creating" } }, dependencies: { PhasedDeployProgressScene } });

      expect(screen.getByRole("heading", { name: "Starting your deployment" })).toBeInTheDocument();
      expect(PhasedDeployProgressScene).not.toHaveBeenCalled();
    });

    it("keeps showing that the deployment is starting while it lands the user on the deployments list", () => {
      const useLandOnDeploymentList = vi.fn();
      setup({
        flow: buildFlow({ autoLeasedDseq: "1000", isCreatingInBackground: true }),
        dependencies: { useLandOnDeploymentList }
      });

      expect(screen.getByRole("heading", { name: "Starting your deployment" })).toBeInTheDocument();
      expect(useLandOnDeploymentList).toHaveBeenLastCalledWith("1000");
    });

    it("lands nowhere before the api took the deploy on", () => {
      const useLandOnDeploymentList = vi.fn();
      setup({ dependencies: { useLandOnDeploymentList } });

      expect(useLandOnDeploymentList).toHaveBeenLastCalledWith(null);
    });

    it("drives the globe for a create the api took on without the provider pick", () => {
      const PhasedDeployProgressScene = vi.fn(ComponentMock);
      setup({ autopilot: { state: { kind: "creating" } }, flow: buildFlow({ isCreatingInBackground: true }), dependencies: { PhasedDeployProgressScene } });

      expect(PhasedDeployProgressScene).toHaveBeenCalled();
      expect(screen.queryByRole("heading", { name: "Starting your deployment" })).not.toBeInTheDocument();
    });

    it("shows a refused create on the progress scene, where funds can be added", () => {
      const PhasedDeployProgressScene = vi.fn(ComponentMock);
      setup({ autopilot: { state: { kind: "error", reason: "needs-funds" } }, dependencies: { PhasedDeployProgressScene } });

      expect(PhasedDeployProgressScene).toHaveBeenCalledWith(expect.objectContaining({ state: { kind: "error", reason: "needs-funds" } }), expect.anything());
    });
  });

  function buildFlow(overrides: Partial<DeploymentFlow> = {}): DeploymentFlow {
    return mock<DeploymentFlow>({ autoLeasedDseq: null, isCreatingInBackground: false, ...overrides });
  }

  function buildAutopilot(overrides: Partial<FlowResult> = {}): FlowResult {
    return {
      state: { kind: "matching" },
      progressPercent: 0,
      phases: [
        { id: "creating", label: "Creating", status: "active" },
        { id: "matching", label: "Matching", status: "pending" },
        { id: "preparing", label: "Preparing", status: "pending" }
      ],
      matchedProviderAddress: null,
      recommendedBidIds: [],
      tryAgain: vi.fn(),
      stopAutopilot: vi.fn(),
      ...overrides
    };
  }

  function setup(
    input: {
      templateName?: string;
      sdl?: string;
      resume?: ResumeResolution;
      flow?: DeploymentFlow;
      contactSupportUrl?: string;
      autopilot?: Partial<FlowResult>;
      useAutoDeploymentFlow?: typeof DEPENDENCIES.useAutoDeploymentFlow;
      organizationRole?: OrganizationRole;
      projectsEnabled?: boolean;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const PhasedDeployProgressScene = input.dependencies?.PhasedDeployProgressScene ?? vi.fn(ComponentMock);
    const useAutoDeploymentFlow: typeof DEPENDENCIES.useAutoDeploymentFlow = input.useAutoDeploymentFlow ?? (() => buildAutopilot(input.autopilot));
    const analyticsService = mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>();
    const openAddCredits = vi.fn();
    const useAddCredits: typeof DEPENDENCIES.useAddCredits = () => openAddCredits;
    const push = vi.fn();
    const useRouter: typeof DEPENDENCIES.useRouter = () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push });
    const useActiveOrganization: typeof DEPENDENCIES.useActiveOrganization = () =>
      mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
        projectsEnabled: input.projectsEnabled ?? true,
        activeOrganization: {
          id: "org-1",
          name: "Acme Corp",
          slug: "acme-corp",
          type: "team",
          role: input.organizationRole ?? "owner",
          isActive: true,
          createdAt: ""
        }
      });
    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        publicConfig: { NEXT_PUBLIC_CONTACT_SUPPORT_URL: input.contactSupportUrl ?? CONTACT_SUPPORT_URL },
        analyticsService
      });

    render(
      <AutoDeployFlow
        templateName={input.templateName ?? "Hello World"}
        sdl={input.sdl ?? "sdl-content"}
        resume={input.resume ?? { activeLeases: [] }}
        flow={input.flow ?? buildFlow()}
        dependencies={{
          Layout: ComponentMock,
          PhasedDeployProgressScene,
          useAutoDeploymentFlow,
          useServices,
          useAddCredits,
          useActiveOrganization,
          useRouter,
          useLandOnDeploymentList: vi.fn(),
          ...input.dependencies
        }}
      />
    );

    return {
      push,
      analyticsService,
      openAddCredits,
      sceneProps: () => (PhasedDeployProgressScene as ReturnType<typeof vi.fn>).mock.calls[0][0] as SceneProps,
      creditsAddedCallback: () => openAddCredits.mock.calls[0][0].onCreditsAdded as () => void
    };
  }
});
