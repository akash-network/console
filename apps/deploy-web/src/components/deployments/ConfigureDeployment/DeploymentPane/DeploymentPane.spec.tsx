import { describe, expect, it } from "vitest";

import { DeploymentPane } from "./DeploymentPane";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("DeploymentPane", () => {
  it("renders expanded with the title and a hide button by default", () => {
    setup();

    expect(screen.getByRole("heading", { name: "1. Deployment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide deployment pane" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show deployment pane" })).not.toBeInTheDocument();
  });

  it("minimizes when the hide button is clicked", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "Hide deployment pane" }));

    expect(screen.queryByRole("heading", { name: "1. Deployment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide deployment pane" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show deployment pane" })).toBeInTheDocument();
  });

  it("restores the expanded view when the show button is clicked", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "Hide deployment pane" }));
    await userEvent.click(screen.getByRole("button", { name: "Show deployment pane" }));

    expect(screen.getByRole("heading", { name: "1. Deployment" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide deployment pane" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show deployment pane" })).not.toBeInTheDocument();
  });

  function setup() {
    return render(<DeploymentPane />);
  }
});
