import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ForwardedPort, LeaseStatusDto } from "@src/queries/useLeaseQuery";
import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { SSH_VM_IMAGES } from "@src/utils/sdl/vmImages";
import { DEPENDENCIES, DeploymentGettingStarted } from "./DeploymentGettingStarted";

import { render, screen } from "@testing-library/react";

const VM_SDL = buildSdl({ vm: SSH_VM_IMAGES["Ubuntu 24.04"] });

describe(DeploymentGettingStarted.name, () => {
  it("shows the ssh command for a live lease whose SSH service is reachable", () => {
    setup({ forwardedPorts: { vm: [forwardedPort({ host: "provider.example.com", externalPort: 31022 })] } });

    expect(screen.getByRole("heading", { name: "Getting started" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Connect over SSH" })).toBeInTheDocument();
    expect(screen.getByLabelText("SSH command for vm")).toHaveTextContent("ssh root@provider.example.com -p 31022 -i ~/.ssh/id_rsa");
    expect(screen.getByText(/Use the private key that matches the public key you deployed with/)).toBeInTheDocument();
  });

  it("names each command's service when more than one service runs SSH", () => {
    setup({
      sdl: buildSdl({ vm: SSH_VM_IMAGES["Ubuntu 24.04"], worker: SSH_VM_IMAGES["Debian 11"] }),
      forwardedPorts: { vm: [forwardedPort({ externalPort: 31022 })], worker: [forwardedPort({ externalPort: 32022 })] }
    });

    expect(screen.getByText("vm")).toBeInTheDocument();
    expect(screen.getByText("worker")).toBeInTheDocument();
    expect(screen.getByLabelText("SSH command for worker")).toHaveTextContent("-p 32022");
  });

  it("shows the command when only some of the services run SSH", () => {
    setup({
      sdl: buildSdl({ web: "nginx:latest", vm: SSH_VM_IMAGES["Ubuntu 24.04"] }),
      forwardedPorts: { web: [forwardedPort({ port: 80 })], vm: [forwardedPort({ externalPort: 31022 })] }
    });

    expect(screen.getByLabelText("SSH command for vm")).toHaveTextContent("-p 31022");
  });

  it("shows the command once a definition with an SSH service replaces one without", () => {
    const { container, rerenderWithSdl } = setup({ sdl: buildSdl({ web: "nginx:latest" }), forwardedPorts: { vm: [forwardedPort()] } });
    expect(container).toBeEmptyDOMElement();

    rerenderWithSdl(VM_SDL);

    expect(screen.getByLabelText("SSH command for vm")).toBeInTheDocument();
  });

  it("leaves the service name off when a single service runs SSH", () => {
    setup({ forwardedPorts: { vm: [forwardedPort()] } });

    expect(screen.queryByText("vm")).not.toBeInTheDocument();
  });

  it("polls the status of the live leases only, each with its provider", () => {
    const liveLease = buildLease({ id: "live", provider: "akash1live" });
    const liveProvider = mock<ApiProviderList>({ owner: "akash1live" });
    const { useLeaseStatuses } = setup({
      leases: [buildLease({ id: "closed", provider: "akash1gone", state: "closed" }), liveLease],
      providers: [mock<ApiProviderList>({ owner: "akash1gone" }), liveProvider],
      forwardedPorts: { vm: [forwardedPort()] }
    });

    expect(useLeaseStatuses).toHaveBeenCalledWith([{ lease: liveLease, provider: liveProvider }], { refetchInterval: 30_000 });
  });

  it("stays off the page without polling when no service runs SSH", () => {
    const { container, useLeaseStatuses } = setup({ sdl: buildSdl({ web: "nginx:latest" }), forwardedPorts: { web: [forwardedPort()] } });

    expect(container).toBeEmptyDOMElement();
    expect(useLeaseStatuses).toHaveBeenCalledWith([], { refetchInterval: 30_000 });
  });

  it("holds the command's place while the lease status loads", () => {
    setup({ isLoading: true });

    expect(screen.getByRole("heading", { name: "Connect over SSH" })).toBeInTheDocument();
    expect(screen.getByTestId("ssh-command-skeleton")).toBeInTheDocument();
  });

  it("stays off the page once the provider reports no forwarded SSH port", () => {
    const { container } = setup({ forwardedPorts: { vm: [forwardedPort({ port: 80 })] } });

    expect(container).toBeEmptyDOMElement();
  });

  it("stays off the page while the provider has not reported the lease status", () => {
    const { container } = setup({});

    expect(container).toBeEmptyDOMElement();
  });

  function setup(input: {
    sdl?: string;
    leases?: LeaseDto[];
    providers?: ApiProviderList[];
    forwardedPorts?: Record<string, ForwardedPort[]>;
    isLoading?: boolean;
  }) {
    const leaseStatus = input.forwardedPorts ? mock<LeaseStatusDto>({ forwarded_ports: input.forwardedPorts }) : undefined;
    const useLeaseStatuses = vi.fn<typeof DEPENDENCIES.useLeaseStatuses>(items =>
      items.map(() =>
        input.isLoading
          ? mock<ReturnType<typeof DEPENDENCIES.useLeaseStatuses>[number]>({ data: undefined, isLoading: true })
          : mock<ReturnType<typeof DEPENDENCIES.useLeaseStatuses>[number]>({ data: leaseStatus, isLoading: false })
      )
    );

    const leases = input.leases ?? [buildLease({ id: "1", provider: "akash1provider" })];
    const providers = input.providers ?? [mock<ApiProviderList>({ owner: "akash1provider" })];
    const renderSection = (sdl: string) => (
      <DeploymentGettingStarted leases={leases} providers={providers} deploymentManifest={sdl} dependencies={{ ...DEPENDENCIES, useLeaseStatuses }} />
    );
    const { container, rerender } = render(renderSection(input.sdl ?? VM_SDL));

    return { container, useLeaseStatuses, rerenderWithSdl: (sdl: string) => rerender(renderSection(sdl)) };
  }

  function buildLease(overrides: { id: string; provider: string; state?: LeaseDto["state"] }): LeaseDto {
    return mock<LeaseDto>({ state: "active", ...overrides });
  }

  function forwardedPort(overrides: Partial<ForwardedPort> = {}): ForwardedPort {
    return { host: "provider.example.com", port: 22, externalPort: 31022, available: 1, ...overrides };
  }
});

function buildSdl(imagesByService: Record<string, string>): string {
  const services = Object.entries(imagesByService)
    .map(([name, image]) => `  ${name}:\n    image: ${image}`)
    .join("\n");
  return `version: "2.0"\nservices:\n${services}\n`;
}
