import { describe, expect, it, vi } from "vitest";

import { BlockedActionButton } from "./BlockedActionButton";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(BlockedActionButton.name, () => {
  it("holds the action back with its reason and reports a click as an attempt", async () => {
    const { onAttempt } = setup();
    const button = screen.getByRole("button", { name: "Deploy" });

    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("1 required field is empty");
    expect(button).toHaveClass("h-10");
    expect(button).toHaveClass("aria-[disabled='true']:pointer-events-auto");
    expect(button).not.toHaveClass("aria-[disabled='true']:pointer-events-none");

    await userEvent.click(button);

    expect(onAttempt).toHaveBeenCalledTimes(1);
  });

  function setup() {
    const onAttempt = vi.fn();
    render(
      <BlockedActionButton reason="1 required field is empty" onAttempt={onAttempt} className="h-10">
        Deploy
      </BlockedActionButton>
    );
    return { onAttempt };
  }
});
