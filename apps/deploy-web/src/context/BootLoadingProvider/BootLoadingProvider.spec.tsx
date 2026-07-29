import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { BOOT_LOADING_FADE_MS, BOOT_LOADING_GRACE_MS, BootLoading, BootLoadingProvider } from "./BootLoadingProvider";

import { act, render, screen } from "@testing-library/react";

describe(BootLoadingProvider.name, () => {
  it("does not render the boot overlay when nothing is loading", () => {
    setup({ children: <div>page</div> });

    expect(screen.queryByTestId("app-boot-loading")).not.toBeInTheDocument();
    expect(screen.getByText("page")).toBeInTheDocument();
  });

  it("renders a single boot overlay with the mark while a gate is loading", () => {
    setup({ children: <BootLoading /> });

    expect(screen.getByTestId("app-boot-loading")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });

  it("keeps the overlay while at least one gate is still loading", () => {
    const { rerender } = setup({
      children: (
        <>
          <BootLoading />
          <BootLoading />
        </>
      )
    });

    rerender(<BootLoading />);

    expect(screen.getByTestId("app-boot-loading")).toBeInTheDocument();
  });

  it("keeps the overlay mounted across a gate handoff", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = setup({ children: <BootLoading /> });
      expect(screen.getByTestId("app-boot-loading")).toBeInTheDocument();

      rerender(<div>between gates</div>);
      act(() => vi.advanceTimersByTime(BOOT_LOADING_GRACE_MS - 1));
      rerender(<BootLoading />);

      expect(screen.getByTestId("app-boot-loading")).toBeInTheDocument();
      expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides the mark but keeps the background fading, then unmounts once boot finishes", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = setup({ children: <BootLoading /> });

      rerender(<div>page</div>);

      act(() => vi.advanceTimersByTime(BOOT_LOADING_GRACE_MS));
      expect(screen.getByTestId("app-boot-loading")).toBeInTheDocument();
      expect(screen.queryByRole("status", { name: /loading/i })).not.toBeInTheDocument();

      act(() => vi.advanceTimersByTime(BOOT_LOADING_FADE_MS));
      expect(screen.queryByTestId("app-boot-loading")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  function setup(input: { children: ReactNode }) {
    const result = render(<BootLoadingProvider>{input.children}</BootLoadingProvider>);
    const rerender = (children: ReactNode) => result.rerender(<BootLoadingProvider>{children}</BootLoadingProvider>);
    return { ...result, rerender };
  }
});
