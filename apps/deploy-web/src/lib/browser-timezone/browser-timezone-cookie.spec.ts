import { describe, expect, it } from "vitest";

import { BROWSER_TIMEZONE_COOKIE_NAME, readBrowserTimezone, rememberBrowserTimezone, serializeBrowserTimezoneCookie } from "./browser-timezone-cookie";

describe(serializeBrowserTimezoneCookie.name, () => {
  it("keeps the timezone for a year on every path", () => {
    expect(serializeBrowserTimezoneCookie("Europe/Paris", { protocol: "http:" })).toBe("console_tz=Europe%2FParis; Path=/; Max-Age=31536000; SameSite=Lax");
  });

  it("marks the cookie secure on https", () => {
    expect(serializeBrowserTimezoneCookie("Europe/Paris", { protocol: "https:" })).toBe(
      "console_tz=Europe%2FParis; Path=/; Max-Age=31536000; SameSite=Lax; Secure"
    );
  });
});

describe(rememberBrowserTimezone.name, () => {
  it("writes the timezone the browser resolves", () => {
    const document = { cookie: "" };

    rememberBrowserTimezone(document, { protocol: "https:" });

    expect(document.cookie).toBe(serializeBrowserTimezoneCookie(Intl.DateTimeFormat().resolvedOptions().timeZone, { protocol: "https:" }));
  });
});

describe(readBrowserTimezone.name, () => {
  it("reads the timezone the browser left in its cookie", () => {
    const req = { cookies: { [BROWSER_TIMEZONE_COOKIE_NAME]: "Asia/Tokyo", other: "value" } };

    expect(readBrowserTimezone(req)).toBe("Asia/Tokyo");
  });

  it("reads nothing when the browser left no timezone", () => {
    const req = { cookies: { other: "value" } };

    expect(readBrowserTimezone(req)).toBeUndefined();
  });
});
