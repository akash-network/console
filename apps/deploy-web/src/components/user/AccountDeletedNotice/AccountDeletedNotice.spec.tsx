import type { NextRouter } from "next/router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./AccountDeletedNotice";
import { AccountDeletedNotice, markAccountDeleted } from "./AccountDeletedNotice";

import { act, render } from "@testing-library/react";

describe(AccountDeletedNotice.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("announces the deletion once on the page the user lands on after signing out", () => {
    markAccountDeleted();

    const { enqueueSnackbar } = setup();

    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Your account has been deleted", iconVariant: "success" }) }),
      { variant: "success" }
    );
    expect(window.sessionStorage.length).toBe(0);
  });

  it("stays quiet when no account was deleted", () => {
    const { enqueueSnackbar } = setup();

    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("announces a deletion marked after the app loaded on the next navigation", () => {
    const { enqueueSnackbar, completeNavigation } = setup();

    markAccountDeleted();
    act(() => completeNavigation());

    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
  });

  it("stops listening to navigation once unmounted", () => {
    const { events, unmount } = setup();
    const listener = events.on.mock.calls[0][1];

    unmount();

    expect(events.off).toHaveBeenCalledWith("routeChangeComplete", listener);
  });

  it("keeps working when session storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => markAccountDeleted()).not.toThrow();
    const { enqueueSnackbar } = setup();

    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  function setup() {
    const events = mock<NextRouter["events"]>();
    const router = mock<NextRouter>({ events });
    const enqueueSnackbar = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useRouter: () => router,
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar: vi.fn() })
    };

    const { unmount } = render(<AccountDeletedNotice dependencies={dependencies} />);

    function completeNavigation() {
      const listener = events.on.mock.calls.find(([event]) => event === "routeChangeComplete")?.[1] as () => void;
      listener();
    }

    return { enqueueSnackbar, events, unmount, completeNavigation };
  }
});
