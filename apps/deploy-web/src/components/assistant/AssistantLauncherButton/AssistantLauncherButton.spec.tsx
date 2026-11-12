import { describe, expect, it, vi } from "vitest";

import { AssistantLauncherButton } from "./AssistantLauncherButton";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(AssistantLauncherButton.name, () => {
  it("opens the assistant when clicked", async () => {
    const { onClick } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Ask the assistant" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("strokes the sparkles icon with the gradient it defines", () => {
    setup();

    const button = screen.getByRole("button", { name: "Ask the assistant" });
    const gradient = button.querySelector("linearGradient");

    expect(button.querySelector("svg.lucide-sparkles")).toHaveAttribute("stroke", `url(#${gradient?.id})`);
  });

  function setup() {
    const onClick = vi.fn();
    render(<AssistantLauncherButton onClick={onClick} />);
    return { onClick };
  }
});
