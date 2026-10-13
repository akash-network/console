import type { MutableRefObject } from "react";
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

  it("returns the focus to the element its owner remembers instead", async () => {
    const { setOpen, returnFocusRef } = setup({ isOpen: false });
    returnFocusRef.current = screen.getByRole("button", { name: "Remembered" });
    screen.getByRole("button", { name: "Before" }).focus();

    setOpen(true);
    setOpen(false);

    await waitFor(() => expect(screen.getByRole("button", { name: "Remembered" })).toHaveFocus());
  });

  it.each([{ role: "dialog" }, { role: "alertdialog" }])("leaves the focus to a $role that is still open", async ({ role }) => {
    const { setOpen } = setup({ isOpen: false, otherDialogRole: role });
    screen.getByRole("button", { name: "Before" }).focus();

    setOpen(true);
    setOpen(false);

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(document.body).toHaveFocus();
  });

  function setup(input: { isOpen: boolean; onCloseAutoFocus?: (event: Event) => void; otherDialogRole?: string }) {
    const onOpenChange = vi.fn();
    const returnFocusRef: MutableRefObject<Element | null> = { current: null };
    let isOpen = input.isOpen;

    const view = () => (
      <>
        <button type="button">Before</button>
        <button type="button">Remembered</button>
        {input.otherDialogRole && <div role={input.otherDialogRole} aria-label="Other" />}
        <CommandPanel isOpen={isOpen} onOpenChange={onOpenChange} returnFocusRef={returnFocusRef} onCloseAutoFocus={input.onCloseAutoFocus}>
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

    return { onOpenChange, setOpen, returnFocusRef };
  }
});
