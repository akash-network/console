import { createStore, Provider as JotaiProvider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { addCreditsRequestAtom } from "@src/store/addCreditsStore";
import { AddCreditsSnackbarContent } from "./useSignAndBroadcast";

import { fireEvent, render, screen } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe("AddCreditsSnackbarContent", () => {
  it("renders the Add Funds button without a PopupProvider, matching notistack's portal where usePopup would throw", () => {
    setup();

    expect(screen.getByRole("button", { name: "Add Funds" })).toBeInTheDocument();
  });

  it("renders the message when provided", () => {
    setup({ message: "Add funds to unlock GPU access" });

    expect(screen.getByText("Add funds to unlock GPU access")).toBeInTheDocument();
  });

  it("requests the add credits sheet rather than a link to billing", () => {
    const { store } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Add Funds" }));

    expect(store.get(addCreditsRequestAtom)).toEqual({
      initialTab: "purchase",
      description: "Add credits to your balance to continue.",
      context: "insufficient_funds_snackbar"
    });
  });

  it("tracks analytics and calls onAction when the button is clicked", () => {
    const onAction = vi.fn();
    const { analyticsService } = setup({ onAction });

    fireEvent.click(screen.getByRole("button", { name: "Add Funds" }));

    expect(analyticsService.track).toHaveBeenCalledWith("add_funds_btn_clk");
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  function setup(input?: { message?: string; onAction?: () => void }) {
    const analyticsService = mock<AnalyticsService>();
    const store = createStore();
    render(
      <JotaiProvider store={store}>
        <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
          <AddCreditsSnackbarContent message={input?.message} onAction={input?.onAction} />
        </TestContainerProvider>
      </JotaiProvider>
    );
    return { analyticsService, store, ...input };
  }
});
