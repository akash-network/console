import type { ReactNode } from "react";
import { createStore, Provider as JotaiProvider } from "jotai";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { seenWhatsNewReleasesAtom, whatsNewViewAtom } from "@src/store/whatsNewStore";
import { ORGANIZATIONS_RELEASE_ID } from "./organizationsRelease";
import { useOpenWhatsNew } from "./useOpenWhatsNew";

import { act, renderHook } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(useOpenWhatsNew.name, () => {
  it("opens the announcement", () => {
    const { result, store } = setup();

    act(() => result.current("account_menu"));

    expect(store.get(whatsNewViewAtom)).toBe("announcement");
  });

  it("remembers the release as seen in this browser", () => {
    const { result, store } = setup({ seenReleases: ["older-release"] });

    act(() => result.current("first_visit"));

    expect(store.get(seenWhatsNewReleasesAtom)).toEqual(["older-release", ORGANIZATIONS_RELEASE_ID]);
    expect(JSON.parse(localStorage.getItem("console.whatsNew.seen") ?? "[]")).toEqual(["older-release", ORGANIZATIONS_RELEASE_ID]);
  });

  it("does not record a replayed release twice", () => {
    const { result, store } = setup({ seenReleases: [ORGANIZATIONS_RELEASE_ID] });

    act(() => result.current("account_menu"));

    expect(store.get(seenWhatsNewReleasesAtom)).toEqual([ORGANIZATIONS_RELEASE_ID]);
  });

  it("tracks what opened the announcement", () => {
    const { result, analyticsService } = setup();

    act(() => result.current("first_visit"));

    expect(analyticsService.track).toHaveBeenCalledWith("whats_new_opened", { category: "user", release: ORGANIZATIONS_RELEASE_ID, trigger: "first_visit" });
  });

  function setup(input: { seenReleases?: string[] } = {}) {
    localStorage.removeItem("console.whatsNew.seen");
    const store = createStore();
    store.set(seenWhatsNewReleasesAtom, input.seenReleases ?? []);
    const analyticsService = mock<AnalyticsService>();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <JotaiProvider store={store}>
        <TestContainerProvider services={{ analyticsService: () => analyticsService }}>{children}</TestContainerProvider>
      </JotaiProvider>
    );

    const { result } = renderHook(() => useOpenWhatsNew(), { wrapper });

    return { result, store, analyticsService };
  }
});
