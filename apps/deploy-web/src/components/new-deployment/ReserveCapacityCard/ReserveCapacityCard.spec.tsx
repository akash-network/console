import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./ReserveCapacityCard";
import { ReserveCapacityCard, STACK_CYCLE_MS, STACK_DROP_MS } from "./ReserveCapacityCard";

import { act, fireEvent, render, screen } from "@testing-library/react";

describe(ReserveCapacityCard.name, () => {
  it("offers a quote for reserved capacity from its button and from anywhere on the card", () => {
    const { onRequestQuote } = setup({});

    expect(screen.getByRole("region", { name: "Reserve capacity" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get a quote" })).toHaveAccessibleDescription("Commit to a term for guaranteed GPUs at a lower rate.");

    fireEvent.click(screen.getByRole("button", { name: "Get a quote" }));
    expect(onRequestQuote).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("heading", { name: "Reserve capacity" }));
    expect(onRequestQuote).toHaveBeenCalledTimes(2);
  });

  it("stacks popular GPUs with the B300 in front", () => {
    setup({});

    expect(stackSlots()).toEqual({ B300: "0", H200: "1", H100: "2", A100: "3" });
    expect(gpuCard("B300")).toHaveTextContent("NVIDIAB300288 GB HBM3e");
  });

  it("drops the front card out and returns it to the back every few seconds", () => {
    setup({});

    act(() => vi.advanceTimersByTime(STACK_CYCLE_MS));
    expect(stackSlots()).toEqual({ B300: "dropping", H200: "0", H100: "1", A100: "2" });

    act(() => vi.advanceTimersByTime(STACK_DROP_MS));
    expect(stackSlots()).toEqual({ B300: "3", H200: "0", H100: "1", A100: "2" });

    act(() => vi.advanceTimersByTime(STACK_CYCLE_MS - STACK_DROP_MS));
    expect(stackSlots()).toEqual({ B300: "2", H200: "dropping", H100: "0", A100: "1" });
  });

  it("holds still while hovered and moves on once the pointer leaves", () => {
    setup({});

    fireEvent.mouseEnter(screen.getByRole("region", { name: "Reserve capacity" }));
    act(() => vi.advanceTimersByTime(STACK_CYCLE_MS * 2));
    expect(stackSlots()).toEqual({ B300: "0", H200: "1", H100: "2", A100: "3" });

    fireEvent.mouseLeave(screen.getByRole("region", { name: "Reserve capacity" }));
    act(() => vi.advanceTimersByTime(STACK_CYCLE_MS + STACK_DROP_MS));
    expect(stackSlots()).toEqual({ B300: "3", H200: "0", H100: "1", A100: "2" });
  });

  it("settles a dropping card at the back when paused mid-drop", () => {
    setup({});

    act(() => vi.advanceTimersByTime(STACK_CYCLE_MS));
    fireEvent.mouseEnter(screen.getByRole("region", { name: "Reserve capacity" }));
    act(() => vi.advanceTimersByTime(STACK_DROP_MS));

    expect(stackSlots()).toEqual({ B300: "3", H200: "0", H100: "1", A100: "2" });
  });

  it("shows a still stack to anyone who asks for reduced motion", () => {
    setup({ prefersReducedMotion: true });

    act(() => vi.advanceTimersByTime(STACK_CYCLE_MS * 2));

    expect(stackSlots()).toEqual({ B300: "0", H200: "1", H100: "2", A100: "3" });
  });

  it("holds still while the page is hidden and moves on once it is shown", () => {
    setup({});

    changePageVisibility("hidden");
    act(() => vi.advanceTimersByTime(STACK_CYCLE_MS * 2));
    expect(stackSlots()).toEqual({ B300: "0", H200: "1", H100: "2", A100: "3" });

    changePageVisibility("visible");
    act(() => vi.advanceTimersByTime(STACK_CYCLE_MS));
    expect(stackSlots()).toEqual({ B300: "dropping", H200: "0", H100: "1", A100: "2" });
  });

  it("slides the returning card back more slowly than the cards stepping forward", () => {
    setup({});

    act(() => vi.advanceTimersByTime(STACK_CYCLE_MS));
    expect(gpuCard("B300").className).toContain("460ms");
    expect(gpuCard("H200").className).toContain("620ms");

    act(() => vi.advanceTimersByTime(STACK_DROP_MS));
    expect(gpuCard("B300").className).toContain("760ms");
    expect(gpuCard("H200").className).toContain("620ms");
    expect(gpuCard("H200")).toHaveClass("motion-reduce:!transition-none");
  });

  it("stops moving and listening to the page once unmounted, even mid-drop", () => {
    const { unmount } = setup({});
    const removeEventListener = vi.spyOn(document, "removeEventListener");
    act(() => vi.advanceTimersByTime(STACK_CYCLE_MS));

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(removeEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });

  function gpuCard(label: string) {
    return screen.getByText(label, { selector: "span" }).closest("[data-slot]")!;
  }

  function stackSlots() {
    return Object.fromEntries(["B300", "H200", "H100", "A100"].map(label => [label, gpuCard(label).getAttribute("data-slot")]));
  }

  function changePageVisibility(visibilityState: DocumentVisibilityState) {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue(visibilityState);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
  }

  function setup(input: { prefersReducedMotion?: boolean }) {
    vi.useFakeTimers();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const onRequestQuote = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useMediaQuery: query => query === "(prefers-reduced-motion: reduce)" && !!input.prefersReducedMotion
    };
    const view = render(<ReserveCapacityCard onRequestQuote={onRequestQuote} dependencies={dependencies} />);

    return { onRequestQuote, unmount: view.unmount };
  }
});
