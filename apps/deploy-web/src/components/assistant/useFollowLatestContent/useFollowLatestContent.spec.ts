import { describe, expect, it, onTestFinished, vi } from "vitest";

import { useFollowLatestContent } from "./useFollowLatestContent";

import { act, fireEvent, renderHook } from "@testing-library/react";

describe(useFollowLatestContent.name, () => {
  it("starts at the bottom once the scroll area is attached", () => {
    const { scrollArea } = setup({ scrollHeight: 900 });

    expect(scrollArea.scrollTop).toBe(900);
  });

  it("watches the content for growth", () => {
    const { content, observedTargets } = setup({ scrollHeight: 900 });

    expect(observedTargets()).toEqual([content]);
  });

  it("follows the content as it grows while the reader is at the bottom", () => {
    const { scrollArea, growTo } = setup({ scrollHeight: 900 });

    growTo(1400);

    expect(scrollArea.scrollTop).toBe(1400);
  });

  it("follows the content while the reader is within the slack above the bottom", () => {
    const { scrollArea, scrollTo, growTo } = setup({ scrollHeight: 900, clientHeight: 400 });

    scrollTo(452);
    growTo(1400);

    expect(scrollArea.scrollTop).toBe(1400);
  });

  it("leaves the reader where they are once they scrolled up past the slack", () => {
    const { scrollArea, scrollTo, growTo } = setup({ scrollHeight: 900, clientHeight: 400 });

    scrollTo(451);
    growTo(1400);

    expect(scrollArea.scrollTop).toBe(451);
  });

  it("follows again once the reader scrolls back to the bottom", () => {
    const { scrollArea, scrollTo, growTo } = setup({ scrollHeight: 900, clientHeight: 400 });

    scrollTo(100);
    scrollTo(500);
    growTo(1400);

    expect(scrollArea.scrollTop).toBe(1400);
  });

  it("snaps back to the bottom and follows again on a new follow key, even after the reader scrolled up", () => {
    const { scrollArea, scrollTo, growTo, rerender } = setup({ scrollHeight: 900, clientHeight: 400 });

    scrollTo(100);
    rerender(2);

    expect(scrollArea.scrollTop).toBe(900);

    growTo(1400);

    expect(scrollArea.scrollTop).toBe(1400);
  });

  it("stops watching the content and the reader once unmounted", () => {
    const { scrollArea, scrollTo, growTo, unmount, observedTargets } = setup({ scrollHeight: 900, clientHeight: 400 });

    unmount();
    scrollTo(100);
    growTo(1400);

    expect(observedTargets()).toEqual([]);
    expect(scrollArea.scrollTop).toBe(100);
  });

  function setup(input: { scrollHeight: number; clientHeight?: number }) {
    const observers: { notify: () => void; targets: Set<Element> }[] = [];

    class ResizeObserverDouble {
      readonly #targets = new Set<Element>();

      constructor(notify: () => void) {
        observers.push({ notify, targets: this.#targets });
      }

      observe(target: Element) {
        this.#targets.add(target);
      }

      unobserve(target: Element) {
        this.#targets.delete(target);
      }

      disconnect() {
        this.#targets.clear();
      }
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });

    const scrollArea = document.createElement("div");
    const content = document.createElement("div");
    scrollArea.append(content);
    Object.defineProperties(scrollArea, {
      scrollTop: { value: 0, writable: true },
      scrollHeight: { value: input.scrollHeight, writable: true },
      clientHeight: { value: input.clientHeight ?? 400, writable: true }
    });

    const view = renderHook(({ followKey }) => useFollowLatestContent(followKey), { initialProps: { followKey: 1 } });
    act(() => {
      view.result.current.scrollAreaRef(scrollArea);
      view.result.current.contentRef(content);
    });

    const scrollTo = (scrollTop: number) => {
      scrollArea.scrollTop = scrollTop;
      fireEvent.scroll(scrollArea);
    };
    const growTo = (scrollHeight: number) => {
      Object.assign(scrollArea, { scrollHeight });
      observers.filter(observer => observer.targets.size > 0).forEach(observer => observer.notify());
    };
    const observedTargets = () => observers.flatMap(observer => [...observer.targets]);
    const rerender = (followKey: number) => view.rerender({ followKey });

    return { scrollArea, content, scrollTo, growTo, observedTargets, rerender, unmount: view.unmount };
  }
});
