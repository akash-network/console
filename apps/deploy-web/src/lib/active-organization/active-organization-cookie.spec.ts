import type { NextApiResponse } from "next";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { expireActiveOrganizationCookie, readActiveOrganizationCookie, serializeActiveOrganizationCookie } from "./active-organization-cookie";

describe(readActiveOrganizationCookie.name, () => {
  it("returns the console_org cookie value from a cookie header", () => {
    expect(readActiveOrganizationCookie("theme=dark; console_org=acme-corp; unleash-session-id=abc")).toBe("acme-corp");
  });

  it("accepts an organization uuid", () => {
    expect(readActiveOrganizationCookie("console_org=0b8f6b2e-3d7c-4a4d-9e1f-2c3a4b5c6d7e")).toBe("0b8f6b2e-3d7c-4a4d-9e1f-2c3a4b5c6d7e");
  });

  it("accepts a value of 64 characters", () => {
    const value = "a".repeat(64);

    expect(readActiveOrganizationCookie(`console_org=${value}`)).toBe(value);
  });

  it("returns undefined when the cookie header has no console_org cookie", () => {
    expect(readActiveOrganizationCookie("theme=dark; console_org_draft=acme-corp")).toBeUndefined();
  });

  it("returns undefined without a cookie header", () => {
    expect(readActiveOrganizationCookie(undefined)).toBeUndefined();
  });

  it("drops an empty console_org cookie", () => {
    expect(readActiveOrganizationCookie("console_org=; theme=dark")).toBeUndefined();
  });

  it("drops a console_org cookie longer than 64 characters", () => {
    expect(readActiveOrganizationCookie(`console_org=${"a".repeat(65)}`)).toBeUndefined();
  });

  it.each([
    ["an uppercase letter", "Acme"],
    ["a space", "acme corp"],
    ["an underscore", "acme_corp"],
    ["a dot", "acme.corp"],
    ["a percent sign", "acme%20corp"]
  ])("drops a console_org cookie containing %s", (_, value) => {
    expect(readActiveOrganizationCookie(`console_org=${value}`)).toBeUndefined();
  });
});

describe(serializeActiveOrganizationCookie.name, () => {
  it("builds a site-wide lax cookie that lasts a year", () => {
    expect(serializeActiveOrganizationCookie("acme-corp", { protocol: "http:" })).toBe("console_org=acme-corp; Path=/; Max-Age=31536000; SameSite=Lax");
  });

  it("marks the cookie as secure when the page is served over https", () => {
    expect(serializeActiveOrganizationCookie("acme-corp", { protocol: "https:" })).toBe(
      "console_org=acme-corp; Path=/; Max-Age=31536000; SameSite=Lax; Secure"
    );
  });

  it("reads the protocol of the current page by default", () => {
    expect(serializeActiveOrganizationCookie("acme-corp")).toBe(serializeActiveOrganizationCookie("acme-corp", window.location));
  });

  it("writes a value that readActiveOrganizationCookie reads back", () => {
    expect(readActiveOrganizationCookie(serializeActiveOrganizationCookie("acme-corp", { protocol: "https:" }))).toBe("acme-corp");
  });
});

describe(expireActiveOrganizationCookie.name, () => {
  it("expires the console_org cookie", () => {
    const { res } = setup({});

    expireActiveOrganizationCookie(res);

    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", ["console_org=; Path=/; Max-Age=0; SameSite=Lax"]);
  });

  it("keeps a cookie already set on the response", () => {
    const { res } = setup({ existing: "appSession=; Path=/" });

    expireActiveOrganizationCookie(res);

    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", ["appSession=; Path=/", "console_org=; Path=/; Max-Age=0; SameSite=Lax"]);
  });

  it("keeps every cookie already set on the response", () => {
    const { res } = setup({ existing: ["appSession=; Path=/", "appSession.0=; Path=/"] });

    expireActiveOrganizationCookie(res);

    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", [
      "appSession=; Path=/",
      "appSession.0=; Path=/",
      "console_org=; Path=/; Max-Age=0; SameSite=Lax"
    ]);
  });

  function setup(input: { existing?: string | string[] }) {
    const res = mock<NextApiResponse>();
    res.getHeader.calledWith("Set-Cookie").mockReturnValue(input.existing);

    return { res };
  }
});
