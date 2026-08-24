import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentSettings } from "./DeploymentSettings";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentSettings", () => {
  it("renders billing, notifications, and danger zone for an active signed-in deployment", () => {
    setup({ state: "active", isSignedIn: true });

    expect(screen.getByText("billing-section")).toBeInTheDocument();
    expect(screen.getByText("notifications:true")).toBeInTheDocument();
    expect(screen.getByText("danger-zone")).toBeInTheDocument();
    expect(screen.getByText("Danger Zone")).toBeInTheDocument();
  });

  it("hides the danger zone when the deployment is closed", () => {
    setup({ state: "closed", isSignedIn: true });

    expect(screen.queryByText("danger-zone")).not.toBeInTheDocument();
    expect(screen.queryByText("Danger Zone")).not.toBeInTheDocument();
  });

  it("disables notifications when the user is not signed in", () => {
    setup({ state: "active", isSignedIn: false });

    expect(screen.getByText("notifications:false")).toBeInTheDocument();
  });

  describe("when escrow is abstracted behind the threshold flag", () => {
    it("hides the billing section for an always-on deployment", () => {
      setup({ state: "active", isSignedIn: true, isEscrowAbstracted: true });

      expect(screen.queryByText("billing-section")).not.toBeInTheDocument();
      expect(screen.queryByText("Billing")).not.toBeInTheDocument();
      expect(screen.getByText("notifications:true")).toBeInTheDocument();
    });

    it("keeps the billing section for a runtime-limited deployment", () => {
      setup({ state: "active", isSignedIn: true, isEscrowAbstracted: true, runtimeLimitHours: 12 });

      expect(screen.getByText("billing-section")).toBeInTheDocument();
      expect(screen.getByText("Billing")).toBeInTheDocument();
    });

    it("keeps the billing section hidden until the deployment settings resolve", () => {
      setup({ state: "active", isSignedIn: true, isEscrowAbstracted: true, isLoadingSettings: true });

      expect(screen.queryByText("billing-section")).not.toBeInTheDocument();
      expect(screen.queryByText("Billing")).not.toBeInTheDocument();
    });
  });

  function setup(input: {
    state?: string;
    isSignedIn?: boolean;
    isEscrowAbstracted?: boolean;
    runtimeLimitHours?: number | null;
    isLoadingSettings?: boolean;
  }) {
    const useUser: typeof DEPENDENCIES.useUser = () =>
      mock<ReturnType<typeof DEPENDENCIES.useUser>>({
        user: input.isSignedIn ? mock<NonNullable<ReturnType<typeof DEPENDENCIES.useUser>["user"]>>({ userId: "u1" }) : undefined
      });
    const useFlag: typeof DEPENDENCIES.useFlag = () => input.isEscrowAbstracted ?? false;
    const settings = Object.assign(mock<NonNullable<ReturnType<typeof DEPENDENCIES.useDeploymentSettingQuery>["data"]>>(), {
      runtimeLimitHours: input.runtimeLimitHours ?? null
    });
    const useDeploymentSettingQuery: typeof DEPENDENCIES.useDeploymentSettingQuery = () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentSettingQuery>>(), { data: input.isLoadingSettings ? undefined : settings });
    const DeploymentBillingSection: typeof DEPENDENCIES.DeploymentBillingSection = vi.fn(() => <div>billing-section</div>);
    const DeploymentNotificationsSection: typeof DEPENDENCIES.DeploymentNotificationsSection = vi.fn(props => (
      <div>notifications:{String(props.isEnabled)}</div>
    ));
    const DeploymentDangerZone: typeof DEPENDENCIES.DeploymentDangerZone = vi.fn(() => <div>danger-zone</div>);

    render(
      <DeploymentSettings
        deployment={mock<DeploymentDto>({ dseq: "1786440078202", state: input.state ?? "active" })}
        leases={[mock<LeaseDto>({ id: "1", state: "active" })]}
        onDeploymentChange={vi.fn()}
        dependencies={MockComponents(DEPENDENCIES, {
          useUser,
          useFlag,
          useDeploymentSettingQuery,
          DeploymentBillingSection,
          DeploymentNotificationsSection,
          DeploymentDangerZone
        })}
      />
    );
  }
});
