import { describe, expect, it, vi } from "vitest";

import { useHasBeenVisible } from "./useHasBeenVisible";

import { act, render, screen } from "@testing-library/react";

describe(useHasBeenVisible.name, () => {
  it("is not visible until the element scrolls into view", () => {
    const { observe } = setup();

    expect(screen.getByTestId("probe")).toHaveTextContent("hidden");
    expect(observe).toHaveBeenCalledWith(screen.getByTestId("probe"));
  });

  it("turns visible once the element enters the view, and stops watching", () => {
    const { report, disconnect } = setup();

    act(() => report(false));
    expect(screen.getByTestId("probe")).toHaveTextContent("hidden");

    act(() => report(true));
    expect(screen.getByTestId("probe")).toHaveTextContent("seen");
    expect(disconnect).toHaveBeenCalled();
  });

  it("counts as seen where there is no observer to ask", () => {
    setup({ hasObserver: false });

    expect(screen.getByTestId("probe")).toHaveTextContent("seen");
  });

  function setup(input: { hasObserver?: boolean } = {}) {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let callback: IntersectionObserverCallback = () => undefined;
    const FakeObserver = vi.fn(function FakeIntersectionObserver(this: unknown, next: IntersectionObserverCallback) {
      callback = next;
      return { observe, disconnect };
    }) as unknown as typeof IntersectionObserver;
    const dependencies = { IntersectionObserver: input.hasObserver === false ? undefined : FakeObserver };

    function Probe() {
      const [ref, hasBeenVisible] = useHasBeenVisible<HTMLDivElement>(dependencies);
      return (
        <div ref={ref} data-testid="probe">
          {hasBeenVisible ? "seen" : "hidden"}
        </div>
      );
    }

    render(<Probe />);

    return {
      observe,
      disconnect,
      report: (isIntersecting: boolean) => callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver)
    };
  }
});
