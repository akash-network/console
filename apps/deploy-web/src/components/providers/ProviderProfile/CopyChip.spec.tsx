import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyChip } from "./CopyChip";

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("CopyChip", () => {
  afterEach(() => {
    vi.useRealTimers();
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

  it("keeps a timer only while it confirms a copy and drops it when unmounted", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { unmount } = setup({ copies: true });
    expect(vi.getTimerCount()).toBe(0);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy provider address" })));
    expect(screen.getByRole("button", { name: "Copy provider address, copied" })).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  function setup(input: { copies: boolean }) {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockImplementation(() => (input.copies ? Promise.resolve() : Promise.reject(new Error("Not allowed"))));
    const { unmount } = render(<CopyChip value="akash1fulladdress" display="akash1ful…ress" label="Copy provider address" />);
    return { user, writeText, unmount };
  }
});
