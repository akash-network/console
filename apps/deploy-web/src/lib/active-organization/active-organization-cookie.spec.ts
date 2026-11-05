import type { NextApiResponse } from "next";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import {
  expireActiveOrganizationCookie,
  getActiveOrganizationCookieName,
  hasDuplicateActiveOrganizationCookie,
  readActiveOrganizationCookie,
  readActiveOrganizationHeader,
  serializeActiveOrganizationCookie,
  serializeActiveOrganizationCookieRemoval
} from "./active-organization-cookie";

const HTTPS = { protocol: "https:" };
const HTTP = { protocol: "http:" };

describe(getActiveOrganizationCookieName.name, () => {
  it("binds the cookie to the console host when the console is served over https", () => {
    expect(getActiveOrganizationCookieName(HTTPS)).toBe("__Host-console_org");
  });

  it("keeps the unprefixed name when the console is served over plain http", () => {
    expect(getActiveOrganizationCookieName(HTTP)).toBe("console_org");
  });
});

describe(readActiveOrganizationCookie.name, () => {
  it("returns the host-bound cookie value from a cookie header over https", () => {
    expect(readActiveOrganizationCookie("theme=dark; __Host-console_org=acme-corp; unleash-session-id=abc", HTTPS)).toBe("acme-corp");
  });

  it("returns the console_org cookie value from a cookie header over http", () => {
    expect(readActiveOrganizationCookie("theme=dark; console_org=acme-corp; unleash-session-id=abc", HTTP)).toBe("acme-corp");
  });

  it("ignores an unprefixed console_org cookie over https", () => {
    expect(readActiveOrganizationCookie("console_org=acme-corp", HTTPS)).toBeUndefined();
  });

  it("ignores a host-bound cookie over http", () => {
    expect(readActiveOrganizationCookie("__Host-console_org=acme-corp", HTTP)).toBeUndefined();
  });

  it("treats a cookie sent twice as no organization, whichever comes first", () => {
    expect(readActiveOrganizationCookie("__Host-console_org=globex; __Host-console_org=acme-corp", HTTPS)).toBeUndefined();
    expect(readActiveOrganizationCookie("console_org=acme-corp; theme=dark; console_org=acme-corp", HTTP)).toBeUndefined();
  });

  it("accepts an organization uuid", () => {
    expect(readActiveOrganizationCookie("console_org=0b8f6b2e-3d7c-4a4d-9e1f-2c3a4b5c6d7e", HTTP)).toBe("0b8f6b2e-3d7c-4a4d-9e1f-2c3a4b5c6d7e");
  });

  it("accepts a value of 64 characters", () => {
    const value = "a".repeat(64);

    expect(readActiveOrganizationCookie(`console_org=${value}`, HTTP)).toBe(value);
  });

  it("returns undefined when the cookie header has no console_org cookie", () => {
    expect(readActiveOrganizationCookie("theme=dark; console_org_draft=acme-corp; my_console_org=globex", HTTP)).toBeUndefined();
  });

  it("returns undefined without a cookie header", () => {
    expect(readActiveOrganizationCookie(undefined, HTTP)).toBeUndefined();
  });

  it("drops an empty console_org cookie", () => {
    expect(readActiveOrganizationCookie("console_org=; theme=dark", HTTP)).toBeUndefined();
  });

  it("drops a console_org cookie longer than 64 characters", () => {
    expect(readActiveOrganizationCookie(`console_org=${"a".repeat(65)}`, HTTP)).toBeUndefined();
  });

  it.each([
    ["an uppercase letter", "Acme"],
    ["a space", "acme corp"],
    ["an underscore", "acme_corp"],
    ["a dot", "acme.corp"],
    ["a percent sign", "acme%20corp"]
  ])("drops a console_org cookie containing %s", (_, value) => {
    expect(readActiveOrganizationCookie(`console_org=${value}`, HTTP)).toBeUndefined();
  });
});

describe(hasDuplicateActiveOrganizationCookie.name, () => {
  it("is true when the cookie header carries the cookie twice", () => {
    expect(hasDuplicateActiveOrganizationCookie("__Host-console_org=acme-corp; theme=dark; __Host-console_org=globex", HTTPS)).toBe(true);
  });

  it("is false when the cookie header carries the cookie once", () => {
    expect(hasDuplicateActiveOrganizationCookie("__Host-console_org=acme-corp; console_org=globex", HTTPS)).toBe(false);
  });

  it("is false without a cookie header", () => {
    expect(hasDuplicateActiveOrganizationCookie(undefined, HTTPS)).toBe(false);
  });
});

describe(readActiveOrganizationHeader.name, () => {
  it("returns an organization id or slug", () => {
    expect(readActiveOrganizationHeader("0b8f6b2e-3d7c-4a4d-9e1f-2c3a4b5c6d7e")).toBe("0b8f6b2e-3d7c-4a4d-9e1f-2c3a4b5c6d7e");
    expect(readActiveOrganizationHeader("acme-corp")).toBe("acme-corp");
  });

  it.each([
    ["no header", undefined],
    ["an empty header", ""],
    ["a header sent twice", ["acme-corp", "globex"]],
    ["a header given as a list", ["acme-corp"]],
    ["an uppercase letter", "Acme"],
    ["a value longer than 64 characters", "a".repeat(65)]
  ])("returns undefined for %s", (_, value) => {
    expect(readActiveOrganizationHeader(value)).toBeUndefined();
  });
});

describe(serializeActiveOrganizationCookie.name, () => {
  it("builds a site-wide lax cookie that lasts a year", () => {
    expect(serializeActiveOrganizationCookie("acme-corp", HTTP)).toBe("console_org=acme-corp; Path=/; Max-Age=31536000; SameSite=Lax");
  });

  it("builds a secure host-bound cookie when the page is served over https", () => {
    expect(serializeActiveOrganizationCookie("acme-corp", HTTPS)).toBe("__Host-console_org=acme-corp; Path=/; Max-Age=31536000; SameSite=Lax; Secure");
  });

  it("reads the protocol of the current page by default", () => {
    expect(serializeActiveOrganizationCookie("acme-corp")).toBe(serializeActiveOrganizationCookie("acme-corp", window.location));
  });

  it("writes a value that readActiveOrganizationCookie reads back", () => {
    expect(readActiveOrganizationCookie(serializeActiveOrganizationCookie("acme-corp", HTTPS), HTTPS)).toBe("acme-corp");
  });
});

describe(expireActiveOrganizationCookie.name, () => {
  it("expires the host-bound cookie over https", () => {
    const { res } = setup({});

    expireActiveOrganizationCookie(res, HTTPS);

    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", ["__Host-console_org=; Path=/; Max-Age=0; SameSite=Lax; Secure"]);
  });

  it("expires the console_org cookie over http", () => {
    const { res } = setup({});

    expireActiveOrganizationCookie(res, HTTP);

    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", ["console_org=; Path=/; Max-Age=0; SameSite=Lax"]);
  });

  it("keeps a cookie already set on the response", () => {
    const { res } = setup({ existing: "appSession=; Path=/" });

    expireActiveOrganizationCookie(res, HTTP);

    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", ["appSession=; Path=/", "console_org=; Path=/; Max-Age=0; SameSite=Lax"]);
  });

  it("keeps every cookie already set on the response", () => {
    const { res } = setup({ existing: ["appSession=; Path=/", "appSession.0=; Path=/"] });

    expireActiveOrganizationCookie(res, HTTP);

    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", ["appSession=; Path=/", "appSession.0=; Path=/", "console_org=; Path=/; Max-Age=0; SameSite=Lax"]);
  });

  function setup(input: { existing?: string | string[] }) {
    const res = mock<NextApiResponse>();
    res.getHeader.calledWith("Set-Cookie").mockReturnValue(input.existing);

    return { res };
  }
});

describe(serializeActiveOrganizationCookieRemoval.name, () => {
  it("expires the cookie on the same path and site policy it was written with", () => {
    expect(serializeActiveOrganizationCookieRemoval(HTTP)).toBe("console_org=; Path=/; Max-Age=0; SameSite=Lax");
  });

  it("expires the host-bound cookie with the Secure attribute browsers require for it", () => {
    expect(serializeActiveOrganizationCookieRemoval(HTTPS)).toBe("__Host-console_org=; Path=/; Max-Age=0; SameSite=Lax; Secure");
  });

  it("reads the protocol of the current page by default", () => {
    expect(serializeActiveOrganizationCookieRemoval()).toBe(serializeActiveOrganizationCookieRemoval(window.location));
  });

  it("leaves nothing for readActiveOrganizationCookie to read", () => {
    expect(readActiveOrganizationCookie(serializeActiveOrganizationCookieRemoval(HTTPS), HTTPS)).toBeUndefined();
  });
});
