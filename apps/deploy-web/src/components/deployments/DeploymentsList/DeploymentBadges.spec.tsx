import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto } from "@src/types/deployment";
import type { DeclaredGpuInterconnect } from "@src/utils/gpuInterconnect";
import { DEPENDENCIES, DeploymentBadges } from "./DeploymentBadges";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(DeploymentBadges.name, () => {
  it("marks a deployment whose groups declare gpu interconnect", () => {
    setup({ interconnect: { enabled: true, fabrics: ["infiniband"] } });

    expect(screen.getByText("gpu interconnect badge")).toBeInTheDocument();
  });

  it("leaves a deployment that declares no interconnect unmarked", () => {
    setup({ interconnect: { enabled: false, fabrics: [] } });

    expect(screen.queryByText("gpu interconnect badge")).not.toBeInTheDocument();
  });

  it("hands the badge the fabrics the deployment pinned, so the tooltip can name them", () => {
    const { GpuInterconnectBadge } = setup({ interconnect: { enabled: true, fabrics: ["roce"] } });

    expect(GpuInterconnectBadge.mock.calls[0][0]).toEqual(expect.objectContaining({ interconnect: { enabled: true, fabrics: ["roce"] } }));
  });

  it("marks every deployment as a trial while the wallet is trialing", () => {
    setup({ isTrialing: true });

    expect(screen.getByText("trial badge")).toBeInTheDocument();
  });

  it("marks nothing as a trial once the wallet has left trialing", () => {
    setup({ isTrialing: false });

    expect(screen.queryByText("trial badge")).not.toBeInTheDocument();
  });

  it("dates the trial from the height the deployment was created at, which is what the countdown reads", () => {
    const { TrialDeploymentBadge } = setup({ isTrialing: true, createdAt: 1234567 });

    expect(TrialDeploymentBadge.mock.calls[0][0]).toEqual(expect.objectContaining({ createdHeight: 1234567 }));
  });

  it("renders no container at all when the deployment earns neither badge", () => {
    const { container } = setup({ interconnect: { enabled: false, fabrics: [] }, isTrialing: false });

    expect(container).toBeEmptyDOMElement();
  });

  it("leaves a closed deployment bare, since its close reason is the only thing left to say about it", () => {
    const { container } = setup({ state: "closed", isTrialing: true, interconnect: { enabled: true, fabrics: ["infiniband"] } });

    expect(container).toBeEmptyDOMElement();
  });

  function setup(input: { interconnect?: DeclaredGpuInterconnect; isTrialing?: boolean; createdAt?: number; state?: string }) {
    const useDeclaredGpuInterconnect: typeof DEPENDENCIES.useDeclaredGpuInterconnect = () => input.interconnect ?? { enabled: false, fabrics: [] };
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing ?? false });
    const GpuInterconnectBadge = vi.fn<typeof DEPENDENCIES.GpuInterconnectBadge>(() => <span>gpu interconnect badge</span>);
    const TrialDeploymentBadge = vi.fn<typeof DEPENDENCIES.TrialDeploymentBadge>(() => <span>trial badge</span>);
    const deployment = mock<DeploymentDto>({ dseq: "100", createdAt: input.createdAt ?? 100, state: input.state ?? "active" });

    const { container } = render(
      <DeploymentBadges
        deployment={deployment}
        dependencies={MockComponents(DEPENDENCIES, { useDeclaredGpuInterconnect, useWallet, GpuInterconnectBadge, TrialDeploymentBadge })}
      />
    );

    return { container, GpuInterconnectBadge, TrialDeploymentBadge, deployment };
  }
});
