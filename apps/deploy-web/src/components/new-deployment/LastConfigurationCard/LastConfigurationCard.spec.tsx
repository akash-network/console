import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { LeaseDto, ListedDeploymentDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, LastConfigurationCard } from "./LastConfigurationCard";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

const WEB_SDL = `
version: "2.0"
services:
  web:
    image: ghcr.io/acme/storefront:2.8.1
`;

describe(LastConfigurationCard.name, () => {
  it("shows the configuration's name, when it was deployed, its provider and its image", () => {
    setup({
      definition: { name: "acme-storefront", sdl: WEB_SDL },
      createdAt: "2026-05-12T10:00:00Z",
      providers: [mock<ApiProviderList>({ owner: "akash1provider", organization: "Mariner Cloud" })]
    });

    expect(screen.getByRole("button", { name: "Redeploy acme-storefront" })).toBeInTheDocument();
    expect(screen.getByText("Last configuration")).toBeInTheDocument();
    expect(screen.getByText("Deployed May 12, 2026 · Mariner Cloud")).toBeInTheDocument();
    expect(screen.getByText("ghcr.io/acme/storefront:2.8.1")).toBeInTheDocument();
  });

  it("summarizes the deployment's resources and gpus", () => {
    const { DeploymentSpecSummary, deployment } = setup({});

    expect(DeploymentSpecSummary).toHaveBeenCalledWith(expect.objectContaining({ deployment, resolvedGpus: expect.any(Array) }), expect.anything());
  });

  it("reads the creation date from the block the deployment was created at", () => {
    const { useBlock } = setup({ deployment: { createdAt: 4242 } });

    expect(useBlock).toHaveBeenCalledWith(4242);
  });

  it("looks up the provider of the deployment's lease", () => {
    const { useProvidersByAddresses } = setup({});

    expect(useProvidersByAddresses).toHaveBeenCalledWith(["akash1provider"]);
  });

  it("looks up no provider for a deployment without a lease", () => {
    const { useProvidersByAddresses } = setup({ deployment: { leases: [] } });

    expect(useProvidersByAddresses).toHaveBeenCalledWith([]);
  });

  it("leaves out the date until the block is read and a provider it does not know", () => {
    setup({ definition: { sdl: "" }, createdAt: undefined, providers: [mock<ApiProviderList>({ owner: "akash1other", organization: "Other" })] });

    expect(screen.queryByText(/Deployed/)).not.toBeInTheDocument();
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Redeploy/ })).toHaveAccessibleDescription("");
  });

  it("names the deployment from the list when the definition carries no name", () => {
    setup({ definition: { name: undefined }, deployment: { name: "from-the-list" } });

    expect(screen.getByRole("button", { name: "Redeploy from-the-list" })).toBeInTheDocument();
  });

  it("falls back to the dseq when neither carries a name", () => {
    setup({ definition: { name: undefined }, deployment: { dseq: "777", name: null } });

    expect(screen.getByRole("button", { name: "Redeploy Deployment #777" })).toBeInTheDocument();
  });

  it("counts the images of the other services", () => {
    setup({
      definition: {
        sdl: `
services:
  web:
    image: nginx:1.27
  db:
    image: postgres:17
  cache:
    image: redis:7
`
      }
    });

    expect(screen.getByText("nginx:1.27 +2 more")).toBeInTheDocument();
  });

  it("leaves out services without an image", () => {
    setup({
      definition: {
        sdl: `
services:
  empty:
  web:
    image: nginx:1.27
  blank:
    image: ""
`
      }
    });

    expect(screen.getByText("nginx:1.27")).toBeInTheDocument();
  });

  it("leaves the image out for an sdl it cannot read", () => {
    setup({ definition: { sdl: "services: [unclosed" } });

    expect(screen.getByRole("button", { name: /Redeploy/ })).toHaveAccessibleDescription("Deployed May 12, 2026");
  });

  it("redeploys the values this browser gave back, carrying the stored secrets over from the deployment", async () => {
    const { redeploy, analyticsService } = setup({
      definition: { name: "acme-storefront", sdl: WEB_SDL, restoredSdl: "restored-sdl" },
      deployment: { dseq: "100" }
    });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy acme-storefront" }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: "restored-sdl", name: "acme-storefront", sourceDseq: "100", projectId: undefined });
    expect(analyticsService.track).toHaveBeenCalledWith("redeploy_last_configuration_btn_clk", "Amplitude");
  });

  it("redeploys the stored sdl under the list's name when the definition has neither", async () => {
    const { redeploy } = setup({ definition: { name: undefined, sdl: WEB_SDL }, deployment: { dseq: "100", name: "from-the-list" } });

    await userEvent.click(screen.getByRole("button", { name: /Redeploy/ }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: WEB_SDL, name: "from-the-list", sourceDseq: "100", projectId: undefined });
  });

  it("redeploys without a name when there is none to carry", async () => {
    const { redeploy } = setup({ definition: { name: undefined, sdl: WEB_SDL }, deployment: { dseq: "100", name: null } });

    await userEvent.click(screen.getByRole("button", { name: /Redeploy/ }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: WEB_SDL, name: undefined, sourceDseq: "100", projectId: undefined });
  });

  it("files the redeploy into the deployment's own project when the page targets none", async () => {
    const { redeploy } = setup({ deployment: { projectId: "project-of-deployment" } });

    await userEvent.click(screen.getByRole("button", { name: /Redeploy/ }));

    expect(redeploy).toHaveBeenCalledWith(expect.objectContaining({ projectId: "project-of-deployment" }));
  });

  it("files the redeploy into the project the page targets over the deployment's own", async () => {
    const { redeploy } = setup({ deployment: { projectId: "project-of-deployment" }, targetProjectId: "target-project" });

    await userEvent.click(screen.getByRole("button", { name: /Redeploy/ }));

    expect(redeploy).toHaveBeenCalledWith(expect.objectContaining({ projectId: "target-project" }));
  });

  describe("when a trial has no usable credit left", () => {
    it("says the trial credit is used up and offers to add credits instead of redeploying", () => {
      setup({ isTrialing: true, isOutOfDeployCredit: true });

      expect(screen.getByRole("button", { name: "Add credits to redeploy acme-storefront" })).toBeInTheDocument();
      expect(screen.getByRole("button")).toHaveAccessibleDescription(expect.stringContaining("Your free trial credit is used up"));
      expect(screen.queryByRole("button", { name: /^Redeploy/ })).not.toBeInTheDocument();
    });

    it("opens add credits rather than redeploying when clicked", async () => {
      const { redeploy, openAddCredits, analyticsService } = setup({ isTrialing: true, isOutOfDeployCredit: true });

      await userEvent.click(screen.getByRole("button", { name: /Add credits to redeploy/ }));

      expect(redeploy).not.toHaveBeenCalled();
      expect(analyticsService.track).toHaveBeenCalledWith("redeploy_last_configuration_add_credits_btn_clk", {
        category: "billing",
        context: "last_configuration_card"
      });
      expect(openAddCredits).toHaveBeenCalledWith({
        initialTab: "purchase",
        description: "Your free trial credit is used up. Add credits to redeploy this configuration.",
        context: "last_configuration_card",
        nextStepLabel: "Redeploy",
        onCreditsAdded: expect.any(Function),
        suggestFirstDeployment: false
      });
    });

    it("redeploys the configuration once the credits are added", async () => {
      const { redeploy, openAddCredits } = setup({
        isTrialing: true,
        isOutOfDeployCredit: true,
        deployment: { dseq: "100", projectId: "project-of-deployment" }
      });
      await userEvent.click(screen.getByRole("button", { name: /Add credits to redeploy/ }));

      openAddCredits.mock.calls[0][0]?.onCreditsAdded?.();

      expect(redeploy).toHaveBeenCalledWith({ sdl: WEB_SDL, name: "acme-storefront", sourceDseq: "100", projectId: "project-of-deployment" });
    });
  });

  it("redeploys as usual for a trial with credit left", async () => {
    const { redeploy, openAddCredits } = setup({ isTrialing: true, isOutOfDeployCredit: false });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy acme-storefront" }));

    expect(redeploy).toHaveBeenCalled();
    expect(openAddCredits).not.toHaveBeenCalled();
    expect(screen.queryByText("Your free trial credit is used up")).not.toBeInTheDocument();
  });

  it("redeploys as usual for a paying account short of credit", async () => {
    const { redeploy, openAddCredits } = setup({ isTrialing: false, isOutOfDeployCredit: true });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy acme-storefront" }));

    expect(redeploy).toHaveBeenCalled();
    expect(openAddCredits).not.toHaveBeenCalled();
    expect(screen.queryByText("Your free trial credit is used up")).not.toBeInTheDocument();
  });

  function setup(input: {
    deployment?: Partial<ListedDeploymentDto>;
    definition?: Partial<DeploymentDefinition>;
    createdAt?: string;
    providers?: ApiProviderList[];
    targetProjectId?: string;
    isTrialing?: boolean;
    isOutOfDeployCredit?: boolean;
  }) {
    const redeploy = vi.fn();
    const openAddCredits = vi.fn<ReturnType<typeof DEPENDENCIES.useAddCredits>>();
    const useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing ?? false });
    const useIsOutOfDeployCredit = () => input.isOutOfDeployCredit ?? false;
    const analyticsService = mock<AnalyticsService>();
    const deployment = {
      dseq: "100",
      state: "active",
      name: "listed-name",
      createdAt: 1000,
      cpuAmount: 1,
      memoryAmount: 1,
      storageAmount: 1,
      leases: [mock<LeaseDto>({ provider: "akash1provider" })],
      ...input.deployment
    } as ListedDeploymentDto;
    const definition = { sdl: WEB_SDL, name: "acme-storefront", source: "api" as const, ...input.definition };
    const createdAt = "createdAt" in input ? input.createdAt : "2026-05-12T10:00:00Z";
    const blockQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useBlock>>(), {
      data: createdAt ? { datetime: createdAt } : undefined
    });
    const providersQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProvidersByAddresses>>(), { data: input.providers ?? [] });
    const useBlock = vi.fn(() => blockQuery);
    const useProvidersByAddresses = vi.fn(() => providersQuery);
    const DeploymentSpecSummary = vi.fn(() => <div>specs</div>);

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <LastConfigurationCard
          deployment={deployment}
          definition={definition}
          targetProjectId={input.targetProjectId}
          dependencies={{
            ...DEPENDENCIES,
            useRedeploy: () => redeploy,
            useBlock,
            useProvidersByAddresses,
            useWallet,
            useIsOutOfDeployCredit,
            useAddCredits: () => openAddCredits,
            DeploymentSpecSummary
          }}
        />
      </TestContainerProvider>
    );

    return { redeploy, openAddCredits, analyticsService, deployment, useBlock, useProvidersByAddresses, DeploymentSpecSummary };
  }
});
