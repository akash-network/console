import { describe, expect, it, vi } from "vitest";

import { StartFromScratchCard } from "./StartFromScratchCard";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("StartFromScratchCard", () => {
  it("describes the starting point and selects it on click", async () => {
    const onSelect = vi.fn();
    render(
      <StartFromScratchCard
        title="Bring your own container"
        description="Run any Docker image."
        example="ghcr.io/you/app:latest"
        artSrc="/images/art.webp"
        onSelect={onSelect}
      />
    );

    const card = screen.getByRole("button", { name: "Bring your own container" });
    expect(card).toHaveAccessibleDescription("Run any Docker image.");
    expect(screen.getByText("ghcr.io/you/app:latest")).toBeInTheDocument();

    await userEvent.click(card);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
