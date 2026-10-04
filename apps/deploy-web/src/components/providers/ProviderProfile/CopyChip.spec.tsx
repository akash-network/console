import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyChip } from "./CopyChip";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("CopyChip", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copies the full value and confirms it for a moment", async () => {
    const { user, writeText } = setup({ copies: true });

    expect(screen.getByRole("button", { name: "Copy provider address" })).toHaveTextContent("akash1ful…ress");
    await user.click(screen.getByRole("button", { name: "Copy provider address" }));

    expect(writeText).toHaveBeenCalledExactlyOnceWith("akash1fulladdress");
    expect(screen.getByRole("button", { name: "Copy provider address, copied" })).toBeInTheDocument();

    await act(() => new Promise(resolve => setTimeout(resolve, 1500)));

    expect(screen.getByRole("button", { name: "Copy provider address" })).toBeInTheDocument();
  });

  it("confirms nothing when the browser refuses the copy", async () => {
    const { user } = setup({ copies: false });

    await user.click(screen.getByRole("button", { name: "Copy provider address" }));

    expect(screen.queryByRole("button", { name: "Copy provider address, copied" })).not.toBeInTheDocument();
  });

  function setup(input: { copies: boolean }) {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockImplementation(() => (input.copies ? Promise.resolve() : Promise.reject(new Error("Not allowed"))));
    render(<CopyChip value="akash1fulladdress" display="akash1ful…ress" label="Copy provider address" />);
    return { user, writeText };
  }
});
