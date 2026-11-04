import type { PropsWithChildren } from "react";
import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";

import { useMarkAutoDeployStart, useTakeAutoDeployStart } from "./useAutoDeployStart";

import { act, renderHook } from "@testing-library/react";

describe(useTakeAutoDeployStart.name, () => {
  it("takes nothing when no deploy button marked a template", () => {
    const { takeOnNextScreen } = setup();

    expect(takeOnNextScreen().result.current).toBeNull();
  });

  it("takes the template a deploy button marked", () => {
    const { mark, takeOnNextScreen } = setup();

    act(() => mark("hello-world"));

    expect(takeOnNextScreen().result.current).toBe("hello-world");
  });

  it("keeps the taken template for the screen that took it", () => {
    const { mark, takeOnNextScreen } = setup();
    act(() => mark("hello-world"));

    const screen = takeOnNextScreen();
    screen.rerender();

    expect(screen.result.current).toBe("hello-world");
  });

  it("leaves nothing for a later screen once one took the mark", () => {
    const { mark, takeOnNextScreen } = setup();
    act(() => mark("hello-world"));
    takeOnNextScreen().unmount();

    expect(takeOnNextScreen().result.current).toBeNull();
  });

  function setup() {
    const store = createStore();
    const wrapper = ({ children }: PropsWithChildren) => <Provider store={store}>{children}</Provider>;
    const marker = renderHook(() => useMarkAutoDeployStart(), { wrapper });

    return {
      mark: (templateId: string) => marker.result.current(templateId),
      takeOnNextScreen: () => renderHook(() => useTakeAutoDeployStart(), { wrapper })
    };
  }
});
