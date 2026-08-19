import { describe, expect, it } from "vitest";

import { DeploymentStatusBadge } from "./DeploymentStatusBadge";

import { render, screen } from "@testing-library/react";

describe("DeploymentStatusBadge", () => {
  it("renders 'Running' for the active state", () => {
    render(<DeploymentStatusBadge state="active" />);

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("renders 'Closed' for the closed state", () => {
    render(<DeploymentStatusBadge state="closed" />);

    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("falls back to the raw state label for unknown states", () => {
    render(<DeploymentStatusBadge state="paused" />);

    expect(screen.getByText("paused")).toBeInTheDocument();
  });
});
