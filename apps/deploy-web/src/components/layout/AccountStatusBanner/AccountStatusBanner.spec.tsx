import { describe, expect, it } from "vitest";

import type { AccountStatus } from "@src/types/user";
import { AccountStatusBanner } from "./AccountStatusBanner";

import { render, screen } from "@testing-library/react";
import { buildAccountStatus } from "@tests/seeders/accountStatus";

describe(AccountStatusBanner.name, () => {
  it("renders the suspension reason", () => {
    setup({ status: "suspended", reason: "Payment dispute under review" });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Your account is suspended. You can still view your balance, deployments and billing and close deployments, but you can't deploy or add funds."
    );
    expect(screen.getByText("Reason: Payment dispute under review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "mailto:support@akash.network");
    expect(screen.getByRole("status")).toHaveClass("bg-warning");
  });

  it("renders the termination notice", () => {
    setup({ status: "terminated", reason: "Terms of service violation" });

    expect(screen.getByRole("status")).toHaveTextContent("Your account has been terminated. This decision is final.");
    expect(screen.queryByText(/you can still view/i)).not.toBeInTheDocument();
    expect(screen.getByText("Reason: Terms of service violation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "mailto:support@akash.network");
    expect(screen.getByRole("status")).toHaveClass("bg-destructive");
  });

  it("leaves out the reason line when there is no reason", () => {
    setup({ status: "suspended", reason: null });

    expect(screen.queryByText(/Reason:/)).not.toBeInTheDocument();
  });

  it("renders nothing for an active account", () => {
    const { container } = setup({ status: "active", reason: null });

    expect(container).toBeEmptyDOMElement();
  });

  function setup(input: { status: AccountStatus; reason: string | null }) {
    return render(<AccountStatusBanner dependencies={{ useAccountStatus: () => buildAccountStatus(input.status, input.reason) }} />);
  }
});
