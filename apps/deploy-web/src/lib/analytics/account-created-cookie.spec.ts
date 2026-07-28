import type { NextApiResponse } from "next";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ACCOUNT_CREATED_COOKIE, setAccountCreatedCookie } from "./account-created-cookie";

describe(setAccountCreatedCookie.name, () => {
  it("sets the one-shot account-created cookie", () => {
    const { res, setHeader } = setup();

    setAccountCreatedCookie(res);

    expect(setHeader).toHaveBeenCalledWith("Set-Cookie", [expect.stringContaining(`${ACCOUNT_CREATED_COOKIE}=1`)]);
  });

  it("preserves cookies already set on the response", () => {
    const existing = "appSession=abc; Path=/";
    const { res, setHeader } = setup({ existing });

    setAccountCreatedCookie(res);

    expect(setHeader).toHaveBeenCalledWith("Set-Cookie", [existing, expect.stringContaining(`${ACCOUNT_CREATED_COOKIE}=1`)]);
  });

  function setup(input: { existing?: string | string[] } = {}) {
    const setHeader = vi.fn();
    const res = mock<NextApiResponse>({
      getHeader: vi.fn().mockReturnValue(input.existing),
      setHeader
    });
    return { res, setHeader };
  }
});
