import { describe, expect, it, vi } from "vitest";

import type { DeploymentCost } from "../../useDeploymentCost/useDeploymentCost";
import type { QuoteExpiry } from "../../useQuoteExpiry/useQuoteExpiry";
import type { WorkspaceCtaState } from "../WorkspaceCtaButton/WorkspaceCtaButton";
import { DeploymentCostBar } from "./DeploymentCostBar";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(DeploymentCostBar.name, () => {
  it("shows the hourly price of a GPU deployment once its bids agree on one", () => {
    const { container } = setup({ hasGpu: true, cost: { minPerBlock: 0.01, maxPerBlock: 0.01, denom: "uact" } });

    expect(screen.getByText("Deployment cost")).toBeInTheDocument();
    expect(container).toHaveTextContent("Deployment cost5.90 uact/hr");
  });

  it("shows the monthly range of the open bids of a CPU-only deployment", () => {
    const { container } = setup({ hasGpu: false, cost: { minPerBlock: 0.01, maxPerBlock: 0.02, denom: "uact" } });

    expect(container).toHaveTextContent("Deployment cost4312.49 uact–8624.98 uact/month");
  });

  it("says no bid is open while none is", () => {
    const { container } = setup({ cost: null });

    expect(container).toHaveTextContent("Deployment costNo open bids");
  });

  it("counts down to the bids expiring", () => {
    setup({ expiry: { secondsLeft: 245, isExpired: false } });

    expect(screen.getByText("Bids expire in 4:05")).toBeInTheDocument();
  });

  it("says when the bids expired", () => {
    setup({ expiry: { secondsLeft: 0, isExpired: true } });

    expect(screen.getByText("Bids expired")).toBeInTheDocument();
    expect(screen.queryByText(/Bids expire in/)).not.toBeInTheDocument();
  });

  it("shows no countdown before the bid window opens", () => {
    setup({ expiry: null });

    expect(screen.queryByText(/Bids expire/)).not.toBeInTheDocument();
  });

  it("offers the bid phase action", () => {
    setup({ ctaState: "requesting" });

    expect(screen.getByRole("button", { name: "Requesting…" })).toBeDisabled();
  });

  it.each<[WorkspaceCtaState, string, "onDeploy" | "onRetry" | "onCloseAndEdit"]>([
    ["deploy", "Deploy", "onDeploy"],
    ["retry", "Retry", "onRetry"],
    ["close-and-edit", "Close and Edit", "onCloseAndEdit"]
  ])("runs the %s action", async (ctaState, name, handler) => {
    const { handlers } = setup({ ctaState });

    await userEvent.click(screen.getByRole("button", { name }));

    expect(handlers[handler]).toHaveBeenCalled();
  });

  function setup(input: { ctaState?: WorkspaceCtaState; cost?: DeploymentCost | null; expiry?: QuoteExpiry | null; hasGpu?: boolean }) {
    const handlers = { onDeploy: vi.fn(), onRetry: vi.fn(), onCloseAndEdit: vi.fn() };
    const { container } = render(
      <DeploymentCostBar
        ctaState={input.ctaState ?? "select-providers"}
        cost={input.cost ?? null}
        expiry={input.expiry ?? null}
        {...handlers}
        dependencies={{
          PriceValue: ({ denom, value }) => <span>{`${Number(value).toFixed(2)} ${denom}`}</span>,
          useDeploymentHasGpu: () => input.hasGpu ?? false
        }}
      />
    );
    return { container, handlers };
  }
});
