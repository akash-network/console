import { createStore, Provider as JotaiProvider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WhatsNewView } from "@src/store/whatsNewStore";
import { seenWhatsNewReleasesAtom, whatsNewViewAtom } from "@src/store/whatsNewStore";
import { ORGANIZATIONS_RELEASE_ID } from "../organizationsRelease";
import type { DEPENDENCIES } from "./WhatsNewAutoOpen";
import { WhatsNewAutoOpen } from "./WhatsNewAutoOpen";

import { act, render } from "@testing-library/react";

describe(WhatsNewAutoOpen.name, () => {
  it("announces the release a moment after the page settles", () => {
    const { openWhatsNew } = setup();

    act(() => vi.advanceTimersByTime(1099));
    expect(openWhatsNew).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(openWhatsNew).toHaveBeenCalledExactlyOnceWith("first_visit");
  });

  it("stays quiet once this browser has seen the release", () => {
    const { openWhatsNew } = setup({ seenReleases: [ORGANIZATIONS_RELEASE_ID] });

    act(() => vi.advanceTimersByTime(5000));

    expect(openWhatsNew).not.toHaveBeenCalled();
  });

  it("still announces when only older releases were seen", () => {
    const { openWhatsNew } = setup({ seenReleases: ["older-release"] });

    act(() => vi.advanceTimersByTime(1100));

    expect(openWhatsNew).toHaveBeenCalledOnce();
  });

  it("waits for the organization to load, since the announcement depends on its type", () => {
    const { openWhatsNew, rerenderWith } = setup({ isOrganizationLoading: true });

    act(() => vi.advanceTimersByTime(5000));
    expect(openWhatsNew).not.toHaveBeenCalled();

    rerenderWith({ isOrganizationLoading: false });
    act(() => vi.advanceTimersByTime(1100));
    expect(openWhatsNew).toHaveBeenCalledOnce();
  });

  it("stays quiet while the announcement or its tour is already showing", () => {
    const { openWhatsNew } = setup({ view: "tour" });

    act(() => vi.advanceTimersByTime(5000));

    expect(openWhatsNew).not.toHaveBeenCalled();
  });

  it.each(["/new-deployment/configure", "/invitations/abc", "/onboarding"])("stays quiet on %s, where the user is mid-task", pathname => {
    const { openWhatsNew } = setup({ pathname });

    act(() => vi.advanceTimersByTime(5000));

    expect(openWhatsNew).not.toHaveBeenCalled();
  });

  it("announces on a page whose path only contains a mid-task path", () => {
    const { openWhatsNew } = setup({ pathname: "/templates/onboarding" });

    act(() => vi.advanceTimersByTime(1100));

    expect(openWhatsNew).toHaveBeenCalledOnce();
  });

  it("announces when the pathname is not known yet", () => {
    const { openWhatsNew } = setup({ pathname: null });

    act(() => vi.advanceTimersByTime(1100));

    expect(openWhatsNew).toHaveBeenCalledOnce();
  });

  it("cancels a pending announcement when the user leaves the page first", () => {
    const { openWhatsNew, unmount } = setup();

    act(() => vi.advanceTimersByTime(500));
    unmount();
    act(() => vi.advanceTimersByTime(5000));

    expect(openWhatsNew).not.toHaveBeenCalled();
  });

  function setup(input: { seenReleases?: string[]; view?: WhatsNewView; pathname?: string | null; isOrganizationLoading?: boolean } = {}) {
    vi.useFakeTimers();
    localStorage.removeItem("console.whatsNew.seen");
    const store = createStore();
    store.set(seenWhatsNewReleasesAtom, input.seenReleases ?? []);
    store.set(whatsNewViewAtom, input.view ?? null);
    const openWhatsNew = vi.fn<ReturnType<typeof DEPENDENCIES.useOpenWhatsNew>>();

    const dependenciesFor = (state: { isOrganizationLoading: boolean }): typeof DEPENDENCIES => ({
      usePathname: () => (input.pathname === undefined ? "/deployments" : input.pathname) as string,
      useActiveOrganization: () => mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ isLoading: state.isOrganizationLoading }),
      useOpenWhatsNew: () => openWhatsNew
    });
    const renderWith = (state: { isOrganizationLoading: boolean }) => (
      <JotaiProvider store={store}>
        <WhatsNewAutoOpen dependencies={dependenciesFor(state)} />
      </JotaiProvider>
    );

    const { rerender, unmount } = render(renderWith({ isOrganizationLoading: input.isOrganizationLoading ?? false }));

    return { openWhatsNew, unmount, rerenderWith: (state: { isOrganizationLoading: boolean }) => rerender(renderWith(state)) };
  }
});
