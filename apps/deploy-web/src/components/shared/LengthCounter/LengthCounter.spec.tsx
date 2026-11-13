import { describe, expect, it } from "vitest";

import { LengthCounter } from "./LengthCounter";

import { render, screen } from "@testing-library/react";

describe(LengthCounter.name, () => {
  it("shows the length against the limit", () => {
    setup({ length: 1234, max: 50_000 });

    expect(screen.getByText("1,234 / 50,000")).not.toHaveClass("text-destructive");
  });

  it("stays neutral at the limit", () => {
    setup({ length: 80, max: 80 });

    expect(screen.getByText("80 / 80")).not.toHaveClass("text-destructive");
  });

  it("turns destructive once the length is over the limit", () => {
    setup({ length: 81, max: 80 });

    expect(screen.getByText("81 / 80")).toHaveClass("text-destructive");
  });

  it("carries the id a field describes itself with", () => {
    setup({ length: 3, max: 80, id: "title-length" });

    expect(screen.getByText("3 / 80")).toHaveAttribute("id", "title-length");
  });

  function setup(input: { length: number; max: number; id?: string }) {
    return render(<LengthCounter {...input} />);
  }
});
