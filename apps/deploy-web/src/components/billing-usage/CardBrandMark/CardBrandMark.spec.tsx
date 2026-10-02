import { describe, expect, it } from "vitest";

import { CardBrandMark } from "./CardBrandMark";

import { render, screen } from "@testing-library/react";

describe(CardBrandMark.name, () => {
  it("draws the Mastercard mark", () => {
    render(<CardBrandMark brand="mastercard" />);

    expect(screen.getByTestId("mastercard-mark")).toBeInTheDocument();
  });

  it.each([
    { brand: "visa", wordmark: "VISA" },
    { brand: "amex", wordmark: "AMEX" },
    { brand: "link", wordmark: "link" }
  ])("writes the $brand wordmark", ({ brand, wordmark }) => {
    render(<CardBrandMark brand={brand} />);

    expect(screen.getByText(wordmark)).toBeInTheDocument();
  });

  it.each([{ brand: "discover" }, { brand: null }])("falls back to a generic card for $brand", ({ brand }) => {
    render(<CardBrandMark brand={brand} />);

    expect(screen.getByTestId("generic-card-mark")).toBeInTheDocument();
    expect(screen.queryByTestId("mastercard-mark")).not.toBeInTheDocument();
  });
});
