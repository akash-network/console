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

  it("keeps following when the scroll event of its own follow lands after the content grew past the slack", () => {
    const { scrollArea, scrollTo, growUnobservedTo, growTo } = setup({ scrollHeight: 900, clientHeight: 400 });

    growTo(1400);
    growUnobservedTo(2000);
    scrollTo(1400);
    growTo(2000);

    expect(scrollArea.scrollTop).toBe(2000);
  });

  it("stays put when the reader scrolls back down without reaching the bottom", () => {
    const { scrollArea, scrollTo, growTo } = setup({ scrollHeight: 900, clientHeight: 400 });

    scrollTo(100);
    scrollTo(300);
    growTo(1400);

    expect(scrollArea.scrollTop).toBe(300);
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

  it.each([
    { detached: "the scroll area", detachesScrollArea: true, detachesContent: false },
    { detached: "the content", detachesScrollArea: false, detachesContent: true },
    { detached: "both elements", detachesScrollArea: true, detachesContent: true }
  ])("stops watching while $detached is detached and follows again once it reattaches", ({ detachesScrollArea, detachesContent }) => {
    const { scrollArea, content, attach, growTo, observedTargets } = setup({ scrollHeight: 900 });

    attach({ scrollArea: detachesScrollArea ? null : scrollArea, content: detachesContent ? null : content });

    expect(observedTargets()).toEqual([]);

    attach({ scrollArea, content });
    growTo(1400);

    expect(observedTargets()).toEqual([content]);
    expect(scrollArea.scrollTop).toBe(1400);
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
    const attach = (elements: { scrollArea: HTMLElement | null; content: HTMLElement | null }) => {
      act(() => {
        view.result.current.scrollAreaRef(elements.scrollArea);
        view.result.current.contentRef(elements.content);
      });
    };
    attach({ scrollArea, content });

    const scrollTo = (scrollTop: number) => {
      scrollArea.scrollTop = scrollTop;
      fireEvent.scroll(scrollArea);
    };
    const growUnobservedTo = (scrollHeight: number) => {
      Object.assign(scrollArea, { scrollHeight });
    };
    const growTo = (scrollHeight: number) => {
      growUnobservedTo(scrollHeight);
      observers.filter(observer => observer.targets.size > 0).forEach(observer => observer.notify());
    };
    const observedTargets = () => observers.flatMap(observer => [...observer.targets]);
    const rerender = (followKey: number) => view.rerender({ followKey });

    return { scrollArea, content, attach, scrollTo, growUnobservedTo, growTo, observedTargets, rerender, unmount: view.unmount };
  }
});
