import type { MouseEventHandler } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { AddCreditsRequest } from "@src/store/addCreditsStore";
import { AddFundsButton, DEPENDENCIES } from "./AddFundsButton";

import { fireEvent, render, screen } from "@testing-library/react";

describe("AddFundsButton", () => {
  it("opens the add credits sheet with the request it was given", () => {
    const request = { initialTab: "purchase", context: "trial_deployment_badge" } as const;
    const { openAddCredits } = setup({ request });

    fireEvent.click(screen.getByRole("button", { name: "Add Funds" }));

    expect(openAddCredits).toHaveBeenCalledWith(request);
  });

  it("tracks the click before opening", () => {
    const { analyticsService } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Add Funds" }));

    expect(analyticsService.track).toHaveBeenCalledWith("add_funds_btn_clk");
  });

  it("does not open the sheet when the login and verification gate swallows the click", () => {
    const { openAddCredits } = setup({ isGateOpen: false });

    fireEvent.click(screen.getByRole("button", { name: "Add Funds" }));

    expect(openAddCredits).not.toHaveBeenCalled();
  });

  function setup(input?: { request?: AddCreditsRequest; isGateOpen?: boolean }) {
    const analyticsService = mock<AnalyticsService>();
    const openAddCredits = vi.fn();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService });
    const useAddCredits: typeof DEPENDENCIES.useAddCredits = () => openAddCredits;
    const useAddFundsVerifiedLoginRequiredEventHandler: typeof DEPENDENCIES.useAddFundsVerifiedLoginRequiredEventHandler =
      () => (callback: MouseEventHandler) => (input?.isGateOpen ?? true ? callback : () => undefined);

    render(
      <AddFundsButton request={input?.request} dependencies={{ ...DEPENDENCIES, useServices, useAddCredits, useAddFundsVerifiedLoginRequiredEventHandler }}>
        Add Funds
      </AddFundsButton>
    );

    return { analyticsService, openAddCredits };
  }
});
