import React from "react";
import { describe, expect, it, vi } from "vitest";

import { CommandPanel } from "./CommandPanel";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(CommandPanel.name, () => {
  it("shows its content in a dialog while open", () => {
    setup({ isOpen: true });

    expect(screen.getByRole("dialog")).toHaveTextContent("Panel content");
  });

  it("renders nothing while closed", () => {
    setup({ isOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks to close on Escape", async () => {
    const { onOpenChange } = setup({ isOpen: true });

    await userEvent.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("returns the focus to the element focused before it opened", async () => {
    const { setOpen } = setup({ isOpen: false });
    screen.getByRole("button", { name: "Before" }).focus();

    setOpen(true);
    expect(screen.getByRole("button", { name: "Inside" })).toHaveFocus();
    setOpen(false);

    await waitFor(() => expect(screen.getByRole("button", { name: "Before" })).toHaveFocus());
  });

  it("leaves the focus alone when the consumer keeps it", async () => {
    const { setOpen } = setup({ isOpen: false, onCloseAutoFocus: event => event.preventDefault() });
    screen.getByRole("button", { name: "Before" }).focus();

    setOpen(true);
    setOpen(false);

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(document.body).toHaveFocus();
  });

  function setup(input: { isOpen: boolean; onCloseAutoFocus?: (event: Event) => void }) {
    const onOpenChange = vi.fn();
    let isOpen = input.isOpen;

    const view = () => (
      <>
        <button type="button">Before</button>
        <CommandPanel isOpen={isOpen} onOpenChange={onOpenChange} onCloseAutoFocus={input.onCloseAutoFocus}>
          <button type="button">Inside</button>
          Panel content
        </CommandPanel>
      </>
    );
    const { rerender } = render(view());

    const setOpen = (nextIsOpen: boolean) => {
      isOpen = nextIsOpen;
      rerender(view());
    };

    return { onOpenChange, setOpen };
  }
});
