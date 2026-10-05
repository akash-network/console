import { afterEach, describe, expect, it } from "vitest";

import { useDeletionLinkToken } from "./useDeletionLinkToken";

import { renderHook } from "@testing-library/react";

describe(useDeletionLinkToken.name, () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("reads the token from the link's fragment", () => {
    const { result } = setup("/user/confirm-delete#token=abc_-123");

    expect(result.current).toBe("abc_-123");
  });

  it("drops the token from the address bar once read", () => {
    setup("/user/confirm-delete?ref=email#token=abc_-123");

    expect(window.location.pathname).toBe("/user/confirm-delete");
    expect(window.location.search).toBe("?ref=email");
    expect(window.location.hash).toBe("");
  });

  it("reports no token for a link without one", () => {
    const { result } = setup("/user/confirm-delete");

    expect(result.current).toBeNull();
  });

  function setup(url: string) {
    window.history.replaceState(null, "", url);
    return renderHook(() => useDeletionLinkToken());
  }
});
