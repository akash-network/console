import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DEPENDENCIES } from "./NotBiddingNotice";
import { NotBiddingNotice } from "./NotBiddingNotice";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(NotBiddingNotice.name, () => {
  it("says bids are unlikely and offers to request compute when no listed provider is bidding", async () => {
    const { onRequestCompute } = setup({ notBiddingCount: 3, providerCount: 3 });

    const notice = screen.getByRole("region", { name: "Bids are unlikely" });
    expect(notice).toHaveTextContent(
      "None of the 3 providers bid on recent test deployments of this GPU. You can still request bids, or tell us what you need."
    );
    await userEvent.click(within(notice).getByRole("button", { name: "Request compute" }));
    expect(onRequestCompute).toHaveBeenCalled();
  });

  it("says how many of the listed providers are not bidding when only some are not", () => {
    setup({ notBiddingCount: 2, providerCount: 4 });

    expect(screen.getByRole("status")).toHaveTextContent("2 of 4 providers haven't bid on recent test deployments of this GPU.");
    expect(screen.queryByRole("region", { name: "Bids are unlikely" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request compute" })).not.toBeInTheDocument();
  });

  it("records that the warning was shown and how severe it was", () => {
    const { analyticsService } = setup({ notBiddingCount: 3, providerCount: 3 });

    expect(analyticsService.track).toHaveBeenCalledWith("configure_not_bidding_warning_shown", {
      category: "deployments",
      bidsUnlikely: true,
      notBiddingProviderCount: 3,
      screenedProviderCount: 3
    });
  });

  it("records the warning again only when its severity changes", () => {
    const { analyticsService, rerenderWith } = setup({ notBiddingCount: 1, providerCount: 4 });

    rerenderWith({ notBiddingCount: 2, providerCount: 4 });
    rerenderWith({ notBiddingCount: 4, providerCount: 4 });

    expect(vi.mocked(analyticsService.track).mock.calls).toEqual([
      ["configure_not_bidding_warning_shown", { category: "deployments", bidsUnlikely: false, notBiddingProviderCount: 1, screenedProviderCount: 4 }],
      ["configure_not_bidding_warning_shown", { category: "deployments", bidsUnlikely: true, notBiddingProviderCount: 4, screenedProviderCount: 4 }]
    ]);
  });

  function setup(input: { notBiddingCount: number; providerCount: number }) {
    const onRequestCompute = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const dependencies: typeof DEPENDENCIES = {
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService })
    };
    const renderNotice = (counts: { notBiddingCount: number; providerCount: number }) => (
      <NotBiddingNotice {...counts} onRequestCompute={onRequestCompute} dependencies={dependencies} />
    );
    const { rerender } = render(renderNotice(input));

    return { onRequestCompute, analyticsService, rerenderWith: (counts: typeof input) => rerender(renderNotice(counts)) };
  }
});
