import { afterEach, describe, expect, it, vi } from "vitest";

import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { LeaseDto } from "@src/types/deployment";
import { DEPENDENCIES, ReclamationBanner } from "./ReclamationBanner";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("ReclamationBanner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when no lease is reclaiming", () => {
    setup({ leases: [createLease({ state: "active" }), createLease({ state: "closed" })] });
    expect(screen.queryByText("This deployment is being reclaimed")).not.toBeInTheDocument();
  });

  it("renders nothing when there are no leases", () => {
    setup({ leases: [] });
    expect(screen.queryByText("This deployment is being reclaimed")).not.toBeInTheDocument();
  });

  it("shows a live countdown to the nearest deadline while a lease is reclaiming", () => {
    const now = new Date("2026-06-05T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const deadline = Math.floor(now.getTime() / 1000) + 3600;

    setup({ leases: [createLease({ state: "reclaiming", reclamation: { deadline } })] });

    expect(screen.getByText("This deployment is being reclaimed")).toBeInTheDocument();
    expect(screen.getByLabelText("reclamation deadline")).toHaveTextContent("closes in 1 hour");
  });

  it("shows 'Closing now…' once the deadline has passed", () => {
    const now = new Date("2026-06-05T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const deadline = Math.floor(now.getTime() / 1000) - 60;

    setup({ leases: [createLease({ state: "reclaiming", reclamation: { deadline } })] });

    expect(screen.getByLabelText("reclamation deadline")).toHaveTextContent("Closing now…");
  });

  it("shows 'Reclamation pending' when a reclaiming lease has no deadline", () => {
    setup({ leases: [createLease({ state: "reclaiming" })] });
    expect(screen.getByLabelText("reclamation deadline")).toHaveTextContent("Reclamation pending");
  });

  it("offers a redeploy action", () => {
    setup({ leases: [createLease({ state: "reclaiming" })] });
    expect(screen.getByRole("button", { name: "Redeploy" })).toBeInTheDocument();
  });

  it("redeploys with the resolved sdl and name when Redeploy is clicked", async () => {
    const { redeploy } = setup({
      leases: [createLease({ state: "reclaiming" })],
      definition: { sdl: "version: 2.0", name: "my-app", source: "api" }
    });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy" }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: 2.0", name: "my-app", sourceDseq: expect.any(String) });
  });

  it("redeploys the values this browser gave back when it holds the running copy", async () => {
    const { redeploy } = setup({
      leases: [createLease({ state: "reclaiming" })],
      definition: { sdl: "version: 2.0 # withheld", restoredSdl: "version: 2.0 # restored", name: "my-app", source: "api" }
    });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy" }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: 2.0 # restored", name: "my-app", sourceDseq: expect.any(String) });
  });

  it("redeploys from the api definition on a device holding no local copy", async () => {
    const { redeploy } = setup({
      leases: [createLease({ state: "reclaiming" })],
      definition: { sdl: "version: 2.0 # from-the-api", name: undefined, source: "api" }
    });

    await userEvent.click(screen.getByRole("button", { name: "Redeploy" }));

    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: 2.0 # from-the-api", name: undefined, sourceDseq: expect.any(String) });
  });

  it("disables Redeploy while the definition is still resolving", () => {
    setup({ leases: [createLease({ state: "reclaiming" })], definition: { sdl: undefined, source: "resolving" } });

    expect(screen.getByRole("button", { name: "Redeploy" })).toBeDisabled();
  });

  it("falls back to a 'new SDL' link when neither source holds a definition", () => {
    setup({ leases: [createLease({ state: "reclaiming" })], definition: { sdl: undefined, source: "absent" } });

    expect(screen.getByRole("link", { name: "Start a new deployment" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeploy" })).not.toBeInTheDocument();
  });

  it("falls back to a 'new SDL' link when the definition is absent despite an inspection-only api sdl", () => {
    setup({ leases: [createLease({ state: "reclaiming" })], definition: { sdl: "version: 2.0 # not-self-contained", source: "absent" } });

    expect(screen.getByRole("link", { name: "Start a new deployment" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeploy" })).not.toBeInTheDocument();
  });

  it("offers no redeploy to a caller who only views the deployment's project", () => {
    const { useCanManageDeployment } = setup({ leases: [createLease({ state: "reclaiming" })], canManage: false });

    expect(screen.getByText("This deployment is being reclaimed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redeploy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Start a new deployment" })).not.toBeInTheDocument();
    expect(useCanManageDeployment).toHaveBeenCalledWith("123");
    expect(screen.getByText(/Ask someone who can deploy into this project to redeploy it before the deadline to avoid downtime./)).toBeInTheDocument();
    expect(screen.queryByText(/Redeploy to another provider before the deadline to avoid downtime./)).not.toBeInTheDocument();
  });

  it("tells a caller who manages the deployment to redeploy it before the deadline", () => {
    setup({ leases: [createLease({ state: "reclaiming" })] });

    expect(screen.getByText(/Redeploy to another provider before the deadline to avoid downtime./)).toBeInTheDocument();
    expect(screen.queryByText(/Ask someone who can deploy into this project to redeploy it before the deadline to avoid downtime./)).not.toBeInTheDocument();
  });

  it("keeps telling the caller to redeploy while their access is still being read", () => {
    setup({ leases: [createLease({ state: "reclaiming" })], canManage: false, isLoadingManagement: true });

    expect(screen.getByText(/Redeploy to another provider before the deadline to avoid downtime./)).toBeInTheDocument();
  });

  function setup(input: { leases: LeaseDto[] | null; definition?: Partial<DeploymentDefinition>; canManage?: boolean; isLoadingManagement?: boolean }) {
    const definition: DeploymentDefinition = { sdl: "version: 2.0", name: "my-app", source: "local", ...input.definition };
    const redeploy = vi.fn();

    const useDeploymentDefinition: typeof DEPENDENCIES.useDeploymentDefinition = () => definition;
    const useNewDeploymentUrl: typeof DEPENDENCIES.useNewDeploymentUrl = () => () => "/new-deployment";
    const useRedeploy: typeof DEPENDENCIES.useRedeploy = () => redeploy;
    const useCanManageDeployment = vi.fn((_dseq: string) => ({
      canManage: input.canManage ?? true,
      isLoading: input.isLoadingManagement ?? false,
      isError: false,
      retry: vi.fn()
    }));

    const utils = render(
      <ReclamationBanner
        leases={input.leases}
        dseq="123"
        dependencies={MockComponents(DEPENDENCIES, { useDeploymentDefinition, useNewDeploymentUrl, useRedeploy, useCanManageDeployment })}
      />
    );

    return { ...utils, redeploy, useCanManageDeployment };
  }

  function createLease(overrides: { state?: string; reclamation?: LeaseDto["reclamation"] } = {}): LeaseDto {
    return {
      id: "1",
      owner: "owner1",
      provider: "provider1",
      dseq: "123",
      gseq: 1,
      oseq: 1,
      state: overrides.state ?? "active",
      price: { denom: "uakt", amount: "100" },
      cpuAmount: 0,
      memoryAmount: 0,
      storageAmount: 0,
      reclamation: overrides.reclamation
    } as LeaseDto;
  }
});
