import { describe, expect, it } from "vitest";

import { ConfigStatusIcon } from "./ConfigStatusIcon";

import { render, screen } from "@testing-library/react";

describe("ConfigStatusIcon", () => {
  it("renders the complete marker when complete", () => {
    render(<ConfigStatusIcon status="complete" />);

    expect(screen.getByRole("img", { name: "Complete" })).toBeInTheDocument();
  });

  it("renders the partial marker when partial", () => {
    render(<ConfigStatusIcon status="partial" />);

    expect(screen.getByRole("img", { name: "Partial" })).toBeInTheDocument();
  });

  it("renders the incomplete marker when incomplete", () => {
    render(<ConfigStatusIcon status="incomplete" />);

    expect(screen.getByRole("img", { name: "Incomplete" })).toBeInTheDocument();
  });
});
