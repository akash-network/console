import { describe, expect, it, vi } from "vitest";

import { PaneLockBanner } from "./PaneLockBanner";

import { fireEvent, render, screen } from "@testing-library/react";

describe(PaneLockBanner.name, () => {
  it("warns that changes need new quotes and triggers cancel-and-edit", () => {
    const onCancelAndEdit = vi.fn();
    render(<PaneLockBanner onCancelAndEdit={onCancelAndEdit} />);
    expect(screen.getByText(/changing a locked setting needs new quotes/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel and edit/i }));
    expect(onCancelAndEdit).toHaveBeenCalled();
  });

  it("reflects close progress with a disabled Cancelling action", () => {
    render(<PaneLockBanner onCancelAndEdit={vi.fn()} isClosing />);
    const action = screen.getByRole("button", { name: /cancelling/i });
    expect(action).toBeDisabled();
    expect(screen.queryByRole("button", { name: /cancel and edit/i })).not.toBeInTheDocument();
  });
});
