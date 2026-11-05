import { describe, expect, it, vi } from "vitest";

import { AssistantComposer } from "./AssistantComposer";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("AssistantComposer", () => {
  it("starts with the prefilled question and sends it with Enter, then empties", async () => {
    const { onSend } = setup({ initialValue: "Why no bids?" });
    const box = screen.getByRole("textbox", { name: "Message the assistant" });

    expect(box).toHaveValue("Why no bids?");
    await userEvent.type(box, "{Enter}");

    expect(onSend).toHaveBeenCalledWith("Why no bids?");
    expect(box).toHaveValue("");
  });

  it("adds a line with Shift+Enter instead of sending", async () => {
    const { onSend } = setup({});
    const box = screen.getByRole("textbox", { name: "Message the assistant" });

    await userEvent.type(box, "one{Shift>}{Enter}{/Shift}two");

    expect(box).toHaveValue("one\ntwo");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send while a word is still being composed", () => {
    const { onSend } = setup({ initialValue: "日本" });

    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", isComposing: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends with the button and keeps it disabled for an empty message or while sending", async () => {
    const { onSend, rerender } = setup({});
    const send = screen.getByRole("button", { name: "Send" });

    expect(send).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox"), "Hello");
    await userEvent.click(send);
    expect(onSend).toHaveBeenCalledWith("Hello");

    await userEvent.type(screen.getByRole("textbox"), "Again");
    rerender(<AssistantComposer isSending onSend={onSend} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox"), "{Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  function setup(input: { initialValue?: string }) {
    const onSend = vi.fn();
    const view = render(<AssistantComposer initialValue={input.initialValue} isSending={false} onSend={onSend} />);
    return { onSend, rerender: view.rerender };
  }
});
