import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentRecovery } from "@src/hooks/useDeploymentStatus/useDeploymentStatus";
import type { LeaseDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentRecoveryAction } from "./DeploymentRecoveryAction";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(DeploymentRecoveryAction.name, () => {
  it("offers to choose a provider again on the configure page of a deployment whose lease was not created", () => {
    setup({ recovery: "choose-provider" });

    expect(screen.getByRole("link", { name: "Choose a provider" })).toHaveAttribute("href", "/new-deployment/configure/1234");
    expect(screen.queryByRole("button", { name: "Send again" })).not.toBeInTheDocument();
  });

  it("sends the deployment again to the provider of a lease that exists, since configure would send it back here", async () => {
    const leases = [mock<LeaseDto>({ state: "active" })];
    const { sendAgain } = setup({ recovery: "send-again", leases });

    await userEvent.click(screen.getByRole("button", { name: "Send again" }));

    expect(sendAgain).toHaveBeenCalledWith({ dseq: "1234", leases });
    expect(screen.queryByRole("link", { name: "Choose a provider" })).not.toBeInTheDocument();
  });

  it("offers the settings to close a deployment whose provider closed its lease, since no provider can bid on it again", () => {
    setup({ recovery: "close" });

    expect(screen.getByRole("link", { name: "Open settings" })).toHaveAttribute("href", "/deployments/1234?tab=SETTINGS");
    expect(screen.queryByRole("link", { name: "Choose a provider" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send again" })).not.toBeInTheDocument();
  });

  it("offers to deploy a closed deployment again from its update tab", () => {
    setup({ recovery: "deploy-again" });

    expect(screen.getByRole("link", { name: "Deploy again" })).toHaveAttribute("href", "/deployments/1234?tab=UPDATE");
    expect(screen.queryByRole("link", { name: "Choose a provider" })).not.toBeInTheDocument();
  });

  it("holds the send while one is already on its way", () => {
    setup({ recovery: "send-again", isSending: true });

    expect(screen.getByRole("button", { name: "Send again" })).toBeDisabled();
  });

  it("lets the send go once nothing is on its way", () => {
    setup({ recovery: "send-again", isSending: false });

    expect(screen.getByRole("button", { name: "Send again" })).toBeEnabled();
  });

  it.each([{ isCompact: true }, { isCompact: false }])("renders the link the same way when compact is $isCompact", ({ isCompact }) => {
    setup({ recovery: "choose-provider", isCompact });

    expect(screen.getByRole("link", { name: "Choose a provider" })).toBeInTheDocument();
  });

  function setup(input: { recovery: DeploymentRecovery; leases?: LeaseDto[]; isSending?: boolean; isCompact?: boolean }) {
    const sendAgain = vi.fn(async () => {});
    const useSendDeploymentAgain: typeof DEPENDENCIES.useSendDeploymentAgain = () => ({ sendAgain, isSending: input.isSending ?? false });

    render(
      <DeploymentRecoveryAction
        dseq="1234"
        recovery={input.recovery}
        leases={input.leases ?? []}
        isCompact={input.isCompact}
        dependencies={{ ...DEPENDENCIES, useSendDeploymentAgain }}
      />
    );

    return { sendAgain };
  }
});
