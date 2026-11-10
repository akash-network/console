import { CustomTooltip, TooltipProvider } from "@akashnetwork/ui/components";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";

import type { AccountStatus } from "@src/types/user";
import { AccountMutationGate, AccountSpendGate } from "./AccountActionGate";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildAccountStatus } from "@tests/seeders/accountStatus";

describe("AccountActionGate", () => {
  describe(AccountSpendGate.name, () => {
    it("leaves the control alone for an active account", async () => {
      const { onClick } = setup({ status: "active", Gate: AccountSpendGate });

      await userEvent.click(screen.getByRole("button", { name: "Deploy" }));

      expect(onClick).toHaveBeenCalled();
    });

    it("disables the control with an explanation for a suspended account", async () => {
      setup({ status: "suspended", Gate: AccountSpendGate });

      expect(screen.getByRole("button", { name: "Deploy" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Deploy" }).parentElement).toHaveClass("cursor-not-allowed");
      await userEvent.tab();
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Your account is suspended, so you can't deploy or add funds.");
    });

    it("takes a link out of reach for a suspended account", () => {
      render(
        <TooltipProvider>
          <AccountSpendGate dependencies={{ useAccountStatus: () => buildAccountStatus("suspended"), CustomTooltip }}>
            <Link href="/new-deployment" className="button">
              New deployment
            </Link>
          </AccountSpendGate>
        </TooltipProvider>
      );
      const link = screen.getByText("New deployment");

      const isNotCancelled = fireEvent.click(link);

      expect(isNotCancelled).toBe(false);
      expect(link).toHaveAttribute("aria-disabled", "true");
      expect(link).toHaveAttribute("tabindex", "-1");
      expect(link).toHaveClass("button", "pointer-events-none", "opacity-50");
    });

    it("disables the control with an explanation for a terminated account", async () => {
      setup({ status: "terminated", Gate: AccountSpendGate });

      expect(screen.getByRole("button", { name: "Deploy" })).toBeDisabled();
      await userEvent.tab();
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Your account has been terminated, so you can't make changes.");
    });
  });

  describe(AccountMutationGate.name, () => {
    it.each<AccountStatus>(["active", "suspended"])("leaves the control alone for a %s account", async status => {
      const { onClick } = setup({ status, Gate: AccountMutationGate });

      await userEvent.click(screen.getByRole("button", { name: "Deploy" }));

      expect(onClick).toHaveBeenCalled();
    });

    it("disables the control with an explanation for a terminated account", async () => {
      setup({ status: "terminated", Gate: AccountMutationGate });

      expect(screen.getByRole("button", { name: "Deploy" })).toBeDisabled();
      await userEvent.tab();
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Your account has been terminated, so you can't make changes.");
    });
  });

  function setup(input: { status: AccountStatus; Gate: typeof AccountSpendGate }) {
    const onClick = vi.fn();
    const useAccountStatus = () => buildAccountStatus(input.status);

    render(
      <TooltipProvider>
        <input.Gate dependencies={{ useAccountStatus, CustomTooltip }}>
          <button type="button" onClick={onClick}>
            Deploy
          </button>
        </input.Gate>
      </TooltipProvider>
    );

    return { onClick };
  }
});
