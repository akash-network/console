import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { DeploymentTabHeader } from "./DeploymentTabHeader";

import { render, screen } from "@testing-library/react";

describe(DeploymentTabHeader.name, () => {
  it("renders the title as a heading", () => {
    setup({ title: "Placements" });

    expect(screen.getByRole("heading", { name: "Placements" })).toBeInTheDocument();
  });

  it("renders actions next to the title", () => {
    setup({ title: "Placements", actions: <button type="button">Expand all</button> });

    expect(screen.getByRole("button", { name: "Expand all" })).toBeInTheDocument();
  });

  function setup(input: { title: string; actions?: ReactNode }) {
    return render(<DeploymentTabHeader title={input.title} actions={input.actions} />);
  }
});
