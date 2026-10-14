import { afterEach, describe, expect, it, vi } from "vitest";

import { forgetInvitationToken, INVITATION_TOKEN_STORAGE_KEY, readStoredInvitationToken, storeInvitationToken } from "./invitation-token-storage";

describe("invitation-token-storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("stores, reads and forgets the token for the tab", () => {
    storeInvitationToken("token-1");

    expect(window.sessionStorage.getItem(INVITATION_TOKEN_STORAGE_KEY)).toBe("token-1");
    expect(readStoredInvitationToken()).toBe("token-1");

    forgetInvitationToken();

    expect(readStoredInvitationToken()).toBeNull();
  });

  it("does without storage when the browser blocks it", () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(() => storeInvitationToken("token-1")).not.toThrow();
    expect(readStoredInvitationToken()).toBeNull();
    expect(() => forgetInvitationToken()).not.toThrow();
  });
});
