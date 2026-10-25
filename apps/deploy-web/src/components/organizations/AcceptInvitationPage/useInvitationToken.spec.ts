import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { INVITATION_TOKEN_STORAGE_KEY } from "@src/lib/organization-invitation/invitation-token-storage";
import type { DEPENDENCIES } from "./useInvitationToken";
import { useInvitationToken } from "./useInvitationToken";

import { act, renderHook } from "@testing-library/react";

describe(useInvitationToken.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("takes the token from the fragment, keeps it for the tab and replaces the route with the clean invitations path", () => {
    const { result, replace } = setup({ url: `/invitations?ref=email#token=${TOKEN}` });

    expect(result.current.token).toBe(TOKEN);
    expect(window.sessionStorage.getItem(INVITATION_TOKEN_STORAGE_KEY)).toBe(TOKEN);
    expect(replace).toHaveBeenCalledExactlyOnceWith("/invitations", undefined, { shallow: true });
  });

  it("reads the token among other fragment parameters", () => {
    const { result } = setup({ url: `/invitations#from=mail&token=${TOKEN}` });

    expect(result.current.token).toBe(TOKEN);
  });

  it("decodes an escaped token and tolerates a mangled one", () => {
    expect(setup({ url: "/invitations#token=abc%2Ddef" }).result.current.token).toBe("abc-def");
    expect(setup({ url: "/invitations#token=abc%" }).result.current.token).toBe("abc%");
  });

  it("falls back to the token kept before authentication without touching the route", () => {
    const { result, replace } = setup({ url: "/invitations", storedToken: TOKEN });

    expect(result.current.token).toBe(TOKEN);
    expect(replace).not.toHaveBeenCalled();
  });

  it("prefers a token in the fragment over an older kept one", () => {
    const { result } = setup({ url: `/invitations#token=${TOKEN}`, storedToken: "older-token" });

    expect(result.current.token).toBe(TOKEN);
    expect(window.sessionStorage.getItem(INVITATION_TOKEN_STORAGE_KEY)).toBe(TOKEN);
  });

  it("reports no token when there is none", () => {
    const { result } = setup({ url: "/invitations#other=1" });

    expect(result.current.token).toBeNull();
  });

  it("reads the link once, so the route change it causes does not read the storage again", () => {
    const { result, rerender, replace } = setup({ url: `/invitations#token=${TOKEN}` });
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/invitations");

    rerender({ router: mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace }) });

    expect(result.current.token).toBe(TOKEN);
    expect(replace).toHaveBeenCalledOnce();
  });

  it("still uses the token from the fragment when session storage is blocked", () => {
    const { result } = setup({ url: `/invitations#token=${TOKEN}`, isStorageBlocked: true });

    expect(result.current.token).toBe(TOKEN);
    expect(() => result.current.forgetToken()).not.toThrow();
  });

  it("forgets the kept token", () => {
    const { result } = setup({ url: `/invitations#token=${TOKEN}` });

    act(() => result.current.forgetToken());

    expect(window.sessionStorage.getItem(INVITATION_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("follows another invitation link opened in the same tab", () => {
    const { result, replace } = setup({ url: `/invitations#token=${TOKEN}` });

    act(() => openInSameTab(`/invitations#token=${OTHER_TOKEN}`));

    expect(result.current.token).toBe(OTHER_TOKEN);
    expect(window.sessionStorage.getItem(INVITATION_TOKEN_STORAGE_KEY)).toBe(OTHER_TOKEN);
    expect(replace).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenLastCalledWith("/invitations", undefined, { shallow: true });
  });

  it("follows a link opened in the tab after it fell back to the kept token", () => {
    const { result } = setup({ url: "/invitations", storedToken: TOKEN });

    act(() => openInSameTab(`/invitations#token=${OTHER_TOKEN}`));

    expect(result.current.token).toBe(OTHER_TOKEN);
  });

  it("keeps the invitation it shows when the fragment changes without a token", () => {
    const { result, replace } = setup({ url: `/invitations#token=${TOKEN}` });

    act(() => openInSameTab("/invitations#section=details"));

    expect(result.current.token).toBe(TOKEN);
    expect(window.sessionStorage.getItem(INVITATION_TOKEN_STORAGE_KEY)).toBe(TOKEN);
    expect(replace).toHaveBeenCalledOnce();
  });

  it("cleans the route of a later link through the router of the current route", () => {
    const { rerender, replace } = setup({ url: `/invitations#token=${TOKEN}` });
    const currentReplace = vi.fn(async () => true);
    rerender({ router: mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace: currentReplace }) });

    act(() => openInSameTab(`/invitations#token=${OTHER_TOKEN}`));

    expect(currentReplace).toHaveBeenCalledExactlyOnceWith("/invitations", undefined, { shallow: true });
    expect(replace).toHaveBeenCalledOnce();
  });

  it("stops following links once the page is gone", () => {
    const { unmount } = setup({ url: `/invitations#token=${TOKEN}` });

    unmount();
    openInSameTab(`/invitations#token=${OTHER_TOKEN}`);

    expect(window.sessionStorage.getItem(INVITATION_TOKEN_STORAGE_KEY)).toBe(TOKEN);
  });

  function openInSameTab(url: string) {
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  function setup(input: { url: string; storedToken?: string; isStorageBlocked?: boolean }) {
    window.sessionStorage.clear();
    if (input.storedToken) window.sessionStorage.setItem(INVITATION_TOKEN_STORAGE_KEY, input.storedToken);
    window.history.replaceState(null, "", input.url);
    if (input.isStorageBlocked) {
      vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
    }
    const replace = vi.fn(async () => true);

    const { result, rerender, unmount } = renderHook(
      ({ router }: { router: ReturnType<typeof DEPENDENCIES.useRouter> }) => useInvitationToken({ dependencies: { useRouter: () => router } }),
      { initialProps: { router: mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace }) } }
    );

    return { result, rerender, unmount, replace };
  }
});

const TOKEN = "Abc_def-ghi".padEnd(43, "x");
const OTHER_TOKEN = "Other_token".padEnd(43, "y");
