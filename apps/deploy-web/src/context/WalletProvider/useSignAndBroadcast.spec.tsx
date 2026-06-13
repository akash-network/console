import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { UrlService } from "@src/utils/urlUtils";
import { AddCreditsSnackbarContent } from "./useSignAndBroadcast";

import { fireEvent, render, screen } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe("AddCreditsSnackbarContent", () => {
  // notistack renders snackbars in a portal mounted outside PopupProvider. Rendering this content
  // without a PopupProvider reproduces that portal context: if it reached usePopup() (via AddFundsLink),
  // it would throw "usePopup must be used within a PopupProvider" and crash the page instead of showing
  // the trial-GPU warning. A plain next/link Link keeps the snackbar self-contained.
  it("renders the Add Funds link without a PopupProvider in the tree", () => {
    setup();

    const link = screen.getByRole("link", { name: "Add Funds" });

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", UrlService.billing({ openPayment: true }));
  });

  it("renders the message when provided", () => {
    setup({ message: "Add funds to unlock GPU access" });

    expect(screen.getByText("Add funds to unlock GPU access")).toBeInTheDocument();
  });

  it("tracks analytics and calls onAction when the link is clicked", () => {
    const onAction = vi.fn();
    const { analyticsService } = setup({ onAction });

    fireEvent.click(screen.getByRole("link", { name: "Add Funds" }));

    expect(analyticsService.track).toHaveBeenCalledWith("add_funds_btn_clk");
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  function setup(input?: { message?: string; onAction?: () => void }) {
    const analyticsService = mock<AnalyticsService>();
    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <AddCreditsSnackbarContent message={input?.message} onAction={input?.onAction} />
      </TestContainerProvider>
    );
    return { analyticsService, ...input };
  }
});
