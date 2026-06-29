import { describe, expect, it } from "vitest";

import { PlacementSelectionBadge } from "./PlacementSelectionBadge";

import { render, screen } from "@testing-library/react";

describe(PlacementSelectionBadge.name, () => {
  it("renders DONE when the placement is selected", () => {
    render(<PlacementSelectionBadge state="done" />);
    expect(screen.getByText("DONE")).toBeInTheDocument();
  });
  it("renders SELECTING when active without a selection", () => {
    render(<PlacementSelectionBadge state="selecting" />);
    expect(screen.getByText("SELECTING")).toBeInTheDocument();
  });
  it("renders WAITING while the placement is awaiting bids", () => {
    render(<PlacementSelectionBadge state="awaiting" />);
    expect(screen.getByText("WAITING")).toBeInTheDocument();
  });
  it("renders nothing when idle", () => {
    const { container } = render(<PlacementSelectionBadge state="idle" />);
    expect(container).toBeEmptyDOMElement();
  });
});
