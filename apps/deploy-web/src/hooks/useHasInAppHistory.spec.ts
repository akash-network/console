import { EventEmitter } from "events";
import type { NextRouter } from "next/router";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useHasInAppHistory";
import { useHasInAppHistory, useTrackInAppNavigation } from "./useHasInAppHistory";

import { renderHook, waitFor } from "@testing-library/react";

describe(useHasInAppHistory.name, () => {
  it("reports no in-app history on the page the session started on", () => {
    const { result } = setup();

    expect(result.current).toBe(false);
  });

  it("reports in-app history once a navigation completes", async () => {
    const { result, completeNavigationTo } = setup();

    completeNavigationTo("/providers");

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("ignores a navigation that starts but never completes", async () => {
    const { result, events } = setup();

    events.emit("routeChangeStart", "/providers");

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("reports no in-app history after going back to the page the session started on", async () => {
    const { result, completeNavigationTo, goBack } = setup({ entryUrl: "/deployment/some-dseq" });

    completeNavigationTo("/providers");
    await waitFor(() => expect(result.current).toBe(true));

    await goBack();

    await waitFor(() => expect(result.current).toBe(false));
  });

  it("keeps in-app history when going back to a page that was itself reached in app", async () => {
    const { result, completeNavigationTo, goBack } = setup();

    completeNavigationTo("/providers");
    completeNavigationTo("/providers/some-address");
    await waitFor(() => expect(result.current).toBe(true));

    await goBack();

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("stops tracking once unmounted", async () => {
    const { result, completeNavigationTo, unmount } = setup();

    unmount();
    completeNavigationTo("/providers");

    await waitFor(() => expect(result.current).toBe(false));
  });

  function setup(input?: { entryUrl?: string }) {
    const events = new EventEmitter();
    const router = Object.assign(mock<NextRouter>(), { events: events as unknown as NextRouter["events"] });
    const useRouter: typeof DEPENDENCIES.useRouter = () => router;

    let entryCount = 0;
    window.history.replaceState({ key: `entry-${entryCount}`, __N: true }, "", input?.entryUrl ?? "/");

    const { result, unmount } = renderHook(() => {
      useTrackInAppNavigation({ useRouter });
      return useHasInAppHistory();
    });

    const completeNavigationTo = (url: string) => {
      entryCount += 1;
      window.history.pushState({ key: `entry-${entryCount}`, __N: true }, "", url);
      events.emit("routeChangeComplete", url);
    };

    const goBack = async () => {
      const hasPopped = new Promise<void>(resolve => window.addEventListener("popstate", () => resolve(), { once: true }));
      window.history.back();
      await hasPopped;
      events.emit("routeChangeComplete", window.location.pathname);
    };

    return { result, events, unmount, completeNavigationTo, goBack };
  }
});
