import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./AskAssistantButton";
import { AskAssistantButton } from "./AskAssistantButton";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("AskAssistantButton", () => {
  it("opens the assistant about the deployment with the question ready", async () => {
    const { open } = setup({ isEnabled: true });

    await userEvent.click(screen.getByRole("button", { name: "Why no bids?" }));

    expect(open).toHaveBeenCalledWith({ context: { dseq: "42" }, question: "Why isn't my deployment getting any bids?" });
  });

  it("renders nothing while the assistant is off", () => {
    setup({ isEnabled: false });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  function setup(input: { isEnabled: boolean }) {
    const open = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useFlag: flag => flag === "user_feedback_loop" && input.isEnabled,
      useAssistantPanel: () => ({ isOpen: false, request: {}, openedAt: 0, open, close: vi.fn() })
    };
    render(<AskAssistantButton dseq="42" question="Why isn't my deployment getting any bids?" label="Why no bids?" dependencies={dependencies} />);
    return { open };
  }
});
