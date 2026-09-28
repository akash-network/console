import { describe, expect, it, vi } from "vitest";

import { LockedDeploymentRail } from "./LockedDeploymentRail";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(LockedDeploymentRail.name, () => {
  it("shows the deployment as locked under its name", () => {
    setup({ deploymentName: "my-app" });

    expect(screen.getByRole("complementary", { name: "Locked deployment" })).toHaveTextContent("Locked");
    expect(screen.getByText("Deployment · my-app")).toBeInTheDocument();
  });

  it("names an unnamed deployment as untitled", () => {
    setup({ deploymentName: "" });

    expect(screen.getByText("Deployment · Untitled")).toBeInTheDocument();
  });

  it("unlocks the configuration and warns that the bids reset", async () => {
    const { onEdit } = setup({ deploymentName: "my-app" });

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAccessibleDescription("unlocks · bids reset");
  });

  function setup(input: { deploymentName: string }) {
    const onEdit = vi.fn();
    render(<LockedDeploymentRail deploymentName={input.deploymentName} onEdit={onEdit} />);
    return { onEdit };
  }
});
