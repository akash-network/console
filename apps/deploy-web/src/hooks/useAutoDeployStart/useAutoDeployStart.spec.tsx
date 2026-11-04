import type { PropsWithChildren } from "react";
import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";

import { useMarkAutoDeployStart, useTakeAutoDeployStart } from "./useAutoDeployStart";

import { act, renderHook } from "@testing-library/react";

type Location = Parameters<typeof useTakeAutoDeployStart>[0];

type ScreenState = Parameters<typeof useTakeAutoDeployStart>[1];

const CONSOLE_START_URL = { sdlStrategy: "default", bidStrategy: "auto" } as const;

describe(useTakeAutoDeployStart.name, () => {
  it("starts the template a deploy button marked before the screen opened", () => {
    const { mark, openScreen } = setup();
    mark("hello-world");

    expect(openScreen({ templateId: "hello-world" }).result.current).toEqual({ templateId: "hello-world", key: 0 });
  });

  it("opens the form when no deploy button marked a template", () => {
    const { openScreen } = setup();

    expect(openScreen({ templateId: "hello-world" }).result.current).toEqual({ templateId: null, key: 0 });
  });

  it("opens the form when the mark is for another template", () => {
    const { mark, openScreen } = setup();
    mark("tpl-1");

    expect(openScreen({ templateId: "hello-world" }).result.current.templateId).toBeNull();
  });

  it("opens the form for a URL naming an existing deployment, even with its template marked", () => {
    const { mark, openScreen } = setup();
    mark("hello-world");

    expect(openScreen({ templateId: "hello-world", dseq: "123" }).result.current.templateId).toBeNull();
  });

  it("leaves nothing for a later screen once one took the mark", () => {
    const { mark, openScreen } = setup();
    mark("hello-world");
    openScreen({ templateId: "hello-world" }).unmount();

    expect(openScreen({ templateId: "hello-world" }).result.current.templateId).toBeNull();
  });

  it("takes a mark set while it is open, leaving nothing for a later screen", () => {
    const { mark, openScreen } = setup();
    const screen = openScreen({ templateId: "tpl-1" });
    mark("hello-world");
    screen.unmount();

    expect(openScreen({ templateId: "hello-world" }).result.current.templateId).toBeNull();
  });

  it("starts afresh for a template marked while the screen is open once the URL moves to it", () => {
    const { mark, openScreen } = setup();
    const screen = openScreen({ templateId: "tpl-1" });

    mark("hello-world");
    screen.navigate({ templateId: "hello-world" });

    expect(screen.result.current).toEqual({ templateId: "hello-world", key: 1 });
  });

  it("starts afresh when the mark and the URL it pushes land together", () => {
    const { markHook, openScreen } = setup();
    const screen = openScreen({ templateId: "tpl-1" });

    act(() => {
      markHook.result.current("hello-world");
      screen.rerender({ location: { templateId: "hello-world" }, state: { hasStartedDeploying: false } });
    });

    expect(screen.result.current).toEqual({ templateId: "hello-world", key: 1 });
  });

  it("keeps the form when the URL moves to a template no deploy button marked", () => {
    const { openScreen } = setup();
    const screen = openScreen({ templateId: "tpl-1" });

    screen.navigate({ templateId: "hello-world" });

    expect(screen.result.current).toEqual({ templateId: null, key: 0 });
  });

  it("keeps the form when the URL moves to another template than the one marked", () => {
    const { mark, openScreen } = setup();
    const screen = openScreen({ templateId: "tpl-1" });

    mark("llama");
    screen.navigate({ templateId: "hello-world" });

    expect(screen.result.current).toEqual({ templateId: null, key: 0 });
  });

  it("drops a mark the next URL template doesn't match, so it never starts a later one", () => {
    const { mark, openScreen } = setup();
    const screen = openScreen({ templateId: "tpl-1" });
    mark("hello-world");
    screen.navigate({ templateId: "llama" });

    screen.navigate({ templateId: "hello-world" });

    expect(screen.result.current.templateId).toBeNull();
  });

  it("keeps its start while the flow writes the created deployment into the URL", () => {
    const { mark, openScreen } = setup();
    mark("hello-world");
    const screen = openScreen({ templateId: "hello-world" });

    screen.navigate({ templateId: "hello-world", dseq: "1000" });

    expect(screen.result.current).toEqual({ templateId: "hello-world", key: 0 });
  });

  it("opens the form when the URL moves off the template it started", () => {
    const { mark, openScreen } = setup();
    mark("hello-world");
    const screen = openScreen({ templateId: "hello-world" });

    screen.navigate({ templateId: "tpl-1" });

    expect(screen.result.current).toEqual({ templateId: null, key: 0 });
  });

  it("keeps the screen when the template it is deploying is marked again", () => {
    const { mark, openScreen } = setup();
    mark("hello-world");
    const screen = openScreen({ templateId: "hello-world", ...CONSOLE_START_URL });

    mark("hello-world");
    screen.navigate({ templateId: "hello-world", ...CONSOLE_START_URL });

    expect(screen.result.current).toEqual({ templateId: "hello-world", key: 0 });
  });

  it("starts afresh the template already on a screen that hasn't started deploying, once the click's push lands", () => {
    const { mark, openScreen } = setup();
    const screen = openScreen({ templateId: "hello-world", draftId: "draft-1" });

    mark("hello-world");
    screen.navigate({ templateId: "hello-world", ...CONSOLE_START_URL });

    expect(screen.result.current).toEqual({ templateId: "hello-world", key: 1 });
  });

  it("starts the template already on screen when the mark and the push land together", () => {
    const { markHook, openScreen } = setup();
    const screen = openScreen({ templateId: "hello-world", draftId: "draft-1" });

    act(() => {
      markHook.result.current("hello-world");
      screen.rerender({ location: { templateId: "hello-world", ...CONSOLE_START_URL }, state: { hasStartedDeploying: false } });
    });

    expect(screen.result.current).toEqual({ templateId: "hello-world", key: 1 });
  });

  it("waits for the click's push before starting the template already on screen", () => {
    const { mark, openScreen } = setup();
    const screen = openScreen({ templateId: "hello-world", draftId: "draft-1", ...CONSOLE_START_URL });

    mark("hello-world");

    expect(screen.result.current).toEqual({ templateId: null, key: 0 });
  });

  it.each([
    { url: "the form strategy", location: { templateId: "hello-world", sdlStrategy: "edit", bidStrategy: "auto" } },
    { url: "the manual bid strategy", location: { templateId: "hello-world", sdlStrategy: "default", bidStrategy: "select" } },
    { url: "a draft id", location: { templateId: "hello-world", draftId: "draft-2", ...CONSOLE_START_URL } }
  ] as const)("doesn't start the template already on screen for a URL carrying $url", ({ location }) => {
    const { mark, openScreen } = setup();
    const screen = openScreen({ templateId: "hello-world", draftId: "draft-1" });

    mark("hello-world");
    screen.navigate(location);

    expect(screen.result.current).toEqual({ templateId: null, key: 0 });
  });

  it("doesn't start the template already on a screen that has started deploying", () => {
    const { mark, openScreen } = setup();
    const screen = openScreen({ templateId: "hello-world", draftId: "draft-1" }, { hasStartedDeploying: true });

    mark("hello-world");
    screen.navigate({ templateId: "hello-world", ...CONSOLE_START_URL }, { hasStartedDeploying: true });

    expect(screen.result.current).toEqual({ templateId: null, key: 0 });
  });

  it("doesn't start the template already on screen for a mark of another template", () => {
    const { mark, openScreen } = setup();
    const screen = openScreen({ templateId: "hello-world", draftId: "draft-1" });

    mark("llama");
    screen.navigate({ templateId: "hello-world", ...CONSOLE_START_URL });

    expect(screen.result.current).toEqual({ templateId: null, key: 0 });
  });

  function setup() {
    const store = createStore();
    const wrapper = ({ children }: PropsWithChildren) => <Provider store={store}>{children}</Provider>;
    const markHook = renderHook(() => useMarkAutoDeployStart(), { wrapper });

    return {
      markHook,
      mark: (templateId: string) => act(() => markHook.result.current(templateId)),
      openScreen: (location: Location, state: ScreenState = { hasStartedDeploying: false }) => {
        const screen = renderHook(({ location, state }: { location: Location; state: ScreenState }) => useTakeAutoDeployStart(location, state), {
          initialProps: { location, state },
          wrapper
        });
        return { ...screen, navigate: (next: Location, nextState: ScreenState = state) => screen.rerender({ location: next, state: nextState }) };
      }
    };
  }
});
