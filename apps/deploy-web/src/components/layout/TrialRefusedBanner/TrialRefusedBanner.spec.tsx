import { describe, expect, it } from "vitest";

import { TrialRefusedBanner } from "./TrialRefusedBanner";

import { render, screen } from "@testing-library/react";

describe(TrialRefusedBanner.name, () => {
  it("tells the user the trial could not start and links to support", () => {
    render(<TrialRefusedBanner />);

    expect(screen.getByRole("status")).toHaveTextContent("Unable to start trial. Please contact support for assistance.");
    expect(screen.getByRole("link", { name: "contact support" })).toHaveAttribute("href", "mailto:support@akash.network");
    expect(screen.getByRole("status")).toHaveClass("bg-warning");
  });
});
