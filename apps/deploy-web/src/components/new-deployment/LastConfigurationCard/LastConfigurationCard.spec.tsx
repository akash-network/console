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

describe("LastConfigurationCard", () => {
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

    expect(useBlock).toHaveBeenCalledWith("4242");
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

    expect(redeploy).toHaveBeenCalledWith({ sdl: "restored-sdl", name: "acme-storefront", sourceDseq: "100" });
    expect(analyticsService.track).toHaveBeenCalledWith("redeploy_last_configuration_btn_clk", "Amplitude");
  });

  it("redeploys the stored sdl under the list's name when the definition has neither", async () => {
    const { redeploy } = setup({ definition: { name: undefined, sdl: WEB_SDL }, deployment: { dseq: "100", name: "from-the-list" } });

    await userEvent.click(screen.getByRole("button", { name: /Redeploy/ }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: WEB_SDL, name: "from-the-list", sourceDseq: "100" });
  });

  it("redeploys without a name when there is none to carry", async () => {
    const { redeploy } = setup({ definition: { name: undefined, sdl: WEB_SDL }, deployment: { dseq: "100", name: null } });

    await userEvent.click(screen.getByRole("button", { name: /Redeploy/ }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: WEB_SDL, name: undefined, sourceDseq: "100" });
  });

  function setup(input: {
    deployment?: Partial<ListedDeploymentDto>;
    definition?: Partial<DeploymentDefinition>;
    createdAt?: string;
    providers?: ApiProviderList[];
  }) {
    const redeploy = vi.fn();
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
      data: createdAt ? { block: { header: { time: createdAt } } } : undefined
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
          dependencies={{ ...DEPENDENCIES, useRedeploy: () => redeploy, useBlock, useProvidersByAddresses, DeploymentSpecSummary }}
        />
      </TestContainerProvider>
    );

    return { redeploy, analyticsService, deployment, useBlock, useProvidersByAddresses, DeploymentSpecSummary };
  }
});
