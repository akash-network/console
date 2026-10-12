import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentRecoveryAction } from "./DeploymentRecoveryAction";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(DeploymentRecoveryAction.name, () => {
  it("offers to choose a provider again on the configure page of a deployment whose lease was not created", () => {
    setup({ hasLease: false });

    expect(screen.getByRole("link", { name: "Choose a provider" })).toHaveAttribute("href", "/new-deployment/configure/1234");
    expect(screen.queryByRole("button", { name: "Send again" })).not.toBeInTheDocument();
  });

  it("sends the deployment again to the provider of a lease that exists, since configure would send it back here", async () => {
    const leases = [mock<LeaseDto>({ state: "active" })];
    const { sendAgain } = setup({ hasLease: true, leases });

    await userEvent.click(screen.getByRole("button", { name: "Send again" }));

    expect(sendAgain).toHaveBeenCalledWith(leases);
    expect(screen.queryByRole("link", { name: "Choose a provider" })).not.toBeInTheDocument();
  });

  it("holds the send while one is already on its way", () => {
    setup({ hasLease: true, isSending: true });

    expect(screen.getByRole("button", { name: "Send again" })).toBeDisabled();
  });

  it("lets the send go once nothing is on its way", () => {
    setup({ hasLease: true, isSending: false });

    expect(screen.getByRole("button", { name: "Send again" })).toBeEnabled();
  });

  it.each([{ isCompact: true }, { isCompact: false }])("renders the link the same way when compact is $isCompact", ({ isCompact }) => {
    setup({ hasLease: false, isCompact });

    expect(screen.getByRole("link", { name: "Choose a provider" })).toBeInTheDocument();
  });

  function setup(input: { hasLease: boolean; leases?: LeaseDto[]; isSending?: boolean; isCompact?: boolean }) {
    const sendAgain = vi.fn(async () => {});
    const useSendDeploymentAgain: typeof DEPENDENCIES.useSendDeploymentAgain = () => ({ sendAgain, isSending: input.isSending ?? false });

    render(
      <DeploymentRecoveryAction
        dseq="1234"
        hasLease={input.hasLease}
        leases={input.leases ?? []}
        isCompact={input.isCompact}
        dependencies={{ ...DEPENDENCIES, useSendDeploymentAgain }}
      />
    );

    return { sendAgain };
  }
});
