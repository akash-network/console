import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { type DEPENDENCIES, FundingBanner } from "./FundingBanner";

import { fireEvent, render, screen } from "@testing-library/react";

describe(FundingBanner.name, () => {
  it("opens add credits on the purchase tab when the banner is clicked", () => {
    const { open } = setup();

    fireEvent.click(screen.getByRole("button"));

    expect(open).toHaveBeenCalledWith(expect.objectContaining({ initialTab: "purchase", description: expect.any(String) }));
  });

  function setup() {
    const open = vi.fn();
    const useBillingSheet: typeof DEPENDENCIES.useBillingSheet = () => mock<ReturnType<typeof DEPENDENCIES.useBillingSheet>>({ open });

    render(<FundingBanner dependencies={{ useBillingSheet }} />);

    return { open };
  }
});
