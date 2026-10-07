import { Container } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { StartFromScratchCard } from "./StartFromScratchCard";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(StartFromScratchCard.name, () => {
  it("describes the starting point and selects it on click", async () => {
    const { onSelect } = setup();

    const card = screen.getByRole("button", { name: "Bring your own container" });
    expect(card).toHaveAccessibleDescription("Run any Docker image.");

    await userEvent.click(card);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("shows a labelled preview of what the starting point opens, hidden from assistive tech", () => {
    setup();

    const preview = screen.getByText("services:").closest("[aria-hidden='true']");
    expect(preview).toHaveTextContent("deploy.yaml");
  });

  function setup() {
    const onSelect = vi.fn();
    render(
      <StartFromScratchCard
        title="Bring your own container"
        description="Run any Docker image."
        previewLabel="deploy.yaml"
        previewIcon={Container}
        preview={<span>services:</span>}
        onSelect={onSelect}
      />
    );

    return { onSelect };
  }
});
