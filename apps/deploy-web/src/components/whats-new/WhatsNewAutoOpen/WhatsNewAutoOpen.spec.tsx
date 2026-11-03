import { createStore, Provider as JotaiProvider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WhatsNewView } from "@src/store/whatsNewStore";
import { seenWhatsNewReleasesAtom, whatsNewViewAtom } from "@src/store/whatsNewStore";
import { ORGANIZATIONS_RELEASE_ID, ORGANIZATIONS_RELEASED_AT } from "../organizationsRelease";
import type { DEPENDENCIES } from "./WhatsNewAutoOpen";
import { WhatsNewAutoOpen } from "./WhatsNewAutoOpen";

import { act, render } from "@testing-library/react";

type OtherDialog = { role: string; state: string } | null;

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

  it("waits while the organization fails to load, so a team member is not shown the personal account's version", () => {
    const { openWhatsNew, rerenderWith } = setup({ hasOrganizationFailedToLoad: true });

    act(() => vi.advanceTimersByTime(5000));
    expect(openWhatsNew).not.toHaveBeenCalled();

    rerenderWith({ hasOrganizationFailedToLoad: false });
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

  it("waits until the router knows the page, which may turn out to be mid-task", () => {
    const { openWhatsNew } = setup({ pathname: null });

    act(() => vi.advanceTimersByTime(5000));

    expect(openWhatsNew).not.toHaveBeenCalled();
  });

  it("cancels a pending announcement when the user leaves the page first", () => {
    const { openWhatsNew, unmount } = setup();

    act(() => vi.advanceTimersByTime(500));
    unmount();
    act(() => vi.advanceTimersByTime(5000));

    expect(openWhatsNew).not.toHaveBeenCalled();
  });

  describe("when another dialog or menu is open", () => {
    it.each(["dialog", "alertdialog", "menu"])("holds the announcement while an open %s is showing, then makes it once it closes", role => {
      const { openWhatsNew, rerenderWith } = setup({ otherDialog: { role, state: "open" } });

      act(() => vi.advanceTimersByTime(5000));
      expect(openWhatsNew).not.toHaveBeenCalled();

      rerenderWith({ otherDialog: null });
      act(() => vi.advanceTimersByTime(1100));
      expect(openWhatsNew).toHaveBeenCalledExactlyOnceWith("first_visit");
    });

    it("does not wait for a dialog that is closing", () => {
      const { openWhatsNew } = setup({ otherDialog: { role: "dialog", state: "closed" } });

      act(() => vi.advanceTimersByTime(1100));

      expect(openWhatsNew).toHaveBeenCalledOnce();
    });

    it("cancels a held announcement when the user leaves the page", () => {
      const { openWhatsNew, unmount } = setup({ otherDialog: { role: "dialog", state: "open" } });

      act(() => vi.advanceTimersByTime(1500));
      unmount();
      act(() => vi.advanceTimersByTime(5000));

      expect(openWhatsNew).not.toHaveBeenCalled();
    });
  });

  describe("when the account was created around the release", () => {
    it("stays quiet for an account created after the release, which never knew Console without organizations", () => {
      const { openWhatsNew } = setup({ accountCreatedAt: "2026-11-01T09:30:00Z" });

      act(() => vi.advanceTimersByTime(5000));

      expect(openWhatsNew).not.toHaveBeenCalled();
    });

    it("stays quiet for an account created the moment the release went out", () => {
      const { openWhatsNew } = setup({ accountCreatedAt: ORGANIZATIONS_RELEASED_AT.toISOString() });

      act(() => vi.advanceTimersByTime(5000));

      expect(openWhatsNew).not.toHaveBeenCalled();
    });

    it("announces to an account created just before the release", () => {
      const { openWhatsNew } = setup({ accountCreatedAt: new Date(ORGANIZATIONS_RELEASED_AT.getTime() - 1).toISOString() });

      act(() => vi.advanceTimersByTime(1100));

      expect(openWhatsNew).toHaveBeenCalledOnce();
    });

    it.each([
      ["the user is still loading", { isUserLoading: true }],
      ["the profile has no creation date", { accountCreatedAt: null }]
    ])("waits while %s, until the account's creation date is known", (_, unknownAccount) => {
      const { openWhatsNew, rerenderWith } = setup(unknownAccount);

      act(() => vi.advanceTimersByTime(5000));
      expect(openWhatsNew).not.toHaveBeenCalled();

      rerenderWith({ isUserLoading: false, accountCreatedAt: "2026-09-01T00:00:00Z" });
      act(() => vi.advanceTimersByTime(1100));
      expect(openWhatsNew).toHaveBeenCalledOnce();
    });
  });

  function setup(
    input: {
      seenReleases?: string[];
      view?: WhatsNewView;
      pathname?: string | null;
      isOrganizationLoading?: boolean;
      hasOrganizationFailedToLoad?: boolean;
      otherDialog?: OtherDialog;
      accountCreatedAt?: string | null;
      isUserLoading?: boolean;
    } = {}
  ) {
    vi.useFakeTimers();
    localStorage.removeItem("console.whatsNew.seen");
    const store = createStore();
    store.set(seenWhatsNewReleasesAtom, input.seenReleases ?? []);
    store.set(whatsNewViewAtom, input.view ?? null);
    const openWhatsNew = vi.fn<ReturnType<typeof DEPENDENCIES.useOpenWhatsNew>>();

    type PageState = {
      isOrganizationLoading: boolean;
      hasOrganizationFailedToLoad: boolean;
      otherDialog: OtherDialog;
      accountCreatedAt: string | null;
      isUserLoading: boolean;
    };
    const dependenciesFor = (state: PageState): typeof DEPENDENCIES => ({
      usePathname: () => (input.pathname === undefined ? "/deployments" : input.pathname) as string,
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ isLoading: state.isOrganizationLoading, isError: state.hasOrganizationFailedToLoad }),
      useUser: () => ({
        user: state.isUserLoading ? undefined : { createdAt: state.accountCreatedAt },
        isLoading: state.isUserLoading,
        error: undefined,
        checkSession: vi.fn()
      }),
      useOpenWhatsNew: () => openWhatsNew
    });
    const renderWith = (state: PageState) => (
      <JotaiProvider store={store}>
        {state.otherDialog && <div role={state.otherDialog.role} data-state={state.otherDialog.state} aria-label="Other dialog" />}
        <WhatsNewAutoOpen dependencies={dependenciesFor(state)} />
      </JotaiProvider>
    );
    const initialState = {
      isOrganizationLoading: input.isOrganizationLoading ?? false,
      hasOrganizationFailedToLoad: input.hasOrganizationFailedToLoad ?? false,
      otherDialog: input.otherDialog ?? null,
      accountCreatedAt: input.accountCreatedAt === undefined ? "2026-09-01T00:00:00Z" : input.accountCreatedAt,
      isUserLoading: input.isUserLoading ?? false
    };

    const { rerender, unmount } = render(renderWith(initialState));

    return { openWhatsNew, unmount, rerenderWith: (state: Partial<PageState>) => rerender(renderWith({ ...initialState, ...state })) };
  }
});
