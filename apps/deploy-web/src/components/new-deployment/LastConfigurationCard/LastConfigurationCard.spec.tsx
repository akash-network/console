import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { WalletBalance } from "@src/hooks/useWalletBalance";
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

  describe("when the account is short of deploy credit", () => {
    it.each([
      { account: "a trial at $0", isTrialing: true, deployBalanceUsd: 0, warning: "Your free trial credit is used up" },
      { account: "a trial below the minimum", isTrialing: true, deployBalanceUsd: 2, warning: "Your free trial credit is below the deployment minimum" },
      { account: "a paying account", isTrialing: false, deployBalanceUsd: 2, warning: "Your balance is too low to start a deployment" }
    ])("warns $account and offers to add credits instead of redeploying", ({ isTrialing, deployBalanceUsd, warning }) => {
      setup({ isTrialing, isOutOfDeployCredit: true, deployBalanceUsd, minimumDepositUsd: 5 });

      expect(screen.getByRole("button", { name: "Add credits to redeploy acme-storefront" })).toHaveAccessibleDescription(
        `Deployed May 12, 2026 ghcr.io/acme/storefront:2.8.1 ${warning}`
      );
      expect(screen.queryByRole("button", { name: /^Redeploy/ })).not.toBeInTheDocument();
    });

    it.each([
      {
        account: "a trial at $0",
        isTrialing: true,
        deployBalanceUsd: 0,
        variant: "trial_credit_used_up",
        description: "Your free trial credit is used up. Add credits to redeploy this configuration."
      },
      {
        account: "a trial below the minimum",
        isTrialing: true,
        deployBalanceUsd: 2,
        variant: "trial_credit_below_minimum",
        description: "You have $2.00 of free trial credit left, and every deployment needs at least $5.00 up front. Add credits to redeploy this configuration."
      },
      {
        account: "a paying account",
        isTrialing: false,
        deployBalanceUsd: 2,
        variant: "not_enough_balance",
        description: "Your balance is too low to start a deployment. Add credits to redeploy this configuration."
      }
    ])("opens add credits explaining the shortfall of $account rather than redeploying", async ({ isTrialing, deployBalanceUsd, variant, description }) => {
      const { redeploy, openAddCredits, analyticsService } = setup({ isTrialing, isOutOfDeployCredit: true, deployBalanceUsd, minimumDepositUsd: 5 });

      await userEvent.click(screen.getByRole("button", { name: /Add credits to redeploy/ }));

      expect(redeploy).not.toHaveBeenCalled();
      expect(analyticsService.track).toHaveBeenCalledWith("redeploy_last_configuration_add_credits_btn_clk", {
        category: "billing",
        context: "last_configuration_card",
        variant
      });
      expect(openAddCredits).toHaveBeenCalledWith({
        initialTab: "purchase",
        description,
        context: "last_configuration_card",
        nextStepLabel: "Redeploy",
        onCreditsAdded: expect.any(Function),
        suggestFirstDeployment: false
      });
    });

    it("redeploys the configuration once the credits are added", async () => {
      const { redeploy, openAddCredits } = setup({
        isOutOfDeployCredit: true,
        deployment: { dseq: "100", projectId: "project-of-deployment" }
      });
      await userEvent.click(screen.getByRole("button", { name: /Add credits to redeploy/ }));

      openAddCredits.mock.calls[0][0]?.onCreditsAdded?.();

      expect(redeploy).toHaveBeenCalledWith({ sdl: WEB_SDL, name: "acme-storefront", sourceDseq: "100", projectId: "project-of-deployment" });
    });
  });

  it.each([
    { account: "a trial", isTrialing: true },
    { account: "a paying account", isTrialing: false }
  ])("redeploys as usual for $account with credit left", async ({ isTrialing }) => {
    const { redeploy, openAddCredits } = setup({ isTrialing, isOutOfDeployCredit: false, deployBalanceUsd: 10, minimumDepositUsd: 5 });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy acme-storefront" }));

    expect(redeploy).toHaveBeenCalled();
    expect(openAddCredits).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveAccessibleDescription("Deployed May 12, 2026 ghcr.io/acme/storefront:2.8.1");
  });

  it("redeploys as usual while the balance and the deployment minimum are still loading", async () => {
    const { redeploy } = setup({ isOutOfDeployCredit: false, deployBalanceUsd: undefined, minimumDepositUsd: undefined });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy acme-storefront" }));

    expect(redeploy).toHaveBeenCalled();
  });

  function setup(input: {
    deployment?: Partial<ListedDeploymentDto>;
    definition?: Partial<DeploymentDefinition>;
    createdAt?: string;
    providers?: ApiProviderList[];
    targetProjectId?: string;
    isTrialing?: boolean;
    isOutOfDeployCredit?: boolean;
    deployBalanceUsd?: number;
    minimumDepositUsd?: number;
  }) {
    const redeploy = vi.fn();
    const openAddCredits = vi.fn<ReturnType<typeof DEPENDENCIES.useAddCredits>>();
    const useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing ?? false });
    const useIsOutOfDeployCredit = () => input.isOutOfDeployCredit ?? false;
    const deployBalanceUsd = "deployBalanceUsd" in input ? input.deployBalanceUsd : 0;
    const minimumDepositUsd = "minimumDepositUsd" in input ? input.minimumDepositUsd : 5;
    const useWalletBalance = () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useWalletBalance>>(), {
        balance: deployBalanceUsd === undefined ? null : mock<WalletBalance>({ totalDeploymentGrantsUSD: deployBalanceUsd })
      });
    const useDeploymentFundingConfigQuery = () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentFundingConfigQuery>>(), {
        data: minimumDepositUsd === undefined ? undefined : { targetRunwayHours: 48, balanceHeadroomUsd: 5, defaultDepositUsd: minimumDepositUsd }
      });
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
            useWalletBalance,
            useDeploymentFundingConfigQuery,
            useAddCredits: () => openAddCredits,
            DeploymentSpecSummary
          }}
        />
      </TestContainerProvider>
    );

    return { redeploy, openAddCredits, analyticsService, deployment, useBlock, useProvidersByAddresses, DeploymentSpecSummary };
  }
});
