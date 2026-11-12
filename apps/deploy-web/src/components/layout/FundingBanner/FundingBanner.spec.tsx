import { describe, expect, it, vi } from "vitest";

import { type DEPENDENCIES, FundingBanner } from "./FundingBanner";

import { fireEvent, render, screen } from "@testing-library/react";

describe(FundingBanner.name, () => {
  it("opens the app-wide Add Credits sheet on the purchase tab on click, recorded as opened from the funding banner", () => {
    const { openAddCredits } = setup();

    fireEvent.click(screen.getByRole("button"));

    expect(openAddCredits).toHaveBeenCalledWith({
      initialTab: "purchase",
      description: expect.stringContaining("You're on the free plan"),
      context: "funding_banner"
    });
  });

  function setup() {
    const openAddCredits = vi.fn();
    const useAddCredits: typeof DEPENDENCIES.useAddCredits = () => openAddCredits;

    render(<FundingBanner dependencies={{ useAddCredits }} />);

    return { openAddCredits };
  }
});
