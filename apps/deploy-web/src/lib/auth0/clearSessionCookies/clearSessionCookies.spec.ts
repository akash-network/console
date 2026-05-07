import type { NextApiRequest, NextApiResponse } from "next";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { clearSessionCookies } from "./clearSessionCookies";

describe("clearSessionCookies", () => {
  it("sets Set-Cookie headers that expire every appSession* cookie", () => {
    const { req, res } = setup({
      cookies: {
        appSession: "abc",
        "appSession.0": "def",
        "appSession.1": "ghi",
        unrelated: "xyz"
      }
    });

    clearSessionCookies(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", [
      "appSession=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "appSession.0=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "appSession.1=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    ]);
  });

  it("does not set any header when no appSession cookies are present", () => {
    const { req, res } = setup({ cookies: { other: "value" } });

    clearSessionCookies(req, res);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("does not set any header when there are no cookies at all", () => {
    const { req, res } = setup({ cookies: {} });

    clearSessionCookies(req, res);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("preserves existing Set-Cookie headers when clearing session cookies", () => {
    const existing = ["other=value; Path=/"];
    const { req, res } = setup({
      cookies: { appSession: "abc" },
      existingSetCookie: existing
    });

    clearSessionCookies(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", [
      "other=value; Path=/",
      "appSession=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    ]);
  });

  it("preserves an existing Set-Cookie header set as a single string", () => {
    const { req, res } = setup({
      cookies: { appSession: "abc" },
      existingSetCookie: "other=value; Path=/"
    });

    clearSessionCookies(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", [
      "other=value; Path=/",
      "appSession=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    ]);
  });

  function setup(input: { cookies: Record<string, string>; existingSetCookie?: string | string[] }) {
    const req = mock<NextApiRequest>({ cookies: input.cookies });
    const res = mock<NextApiResponse>();
    res.getHeader.mockReturnValue(input.existingSetCookie);
    return { req, res };
  }
});
