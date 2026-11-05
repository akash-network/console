import { describe, expect, it } from "vitest";

import { hasAmbiguousSessionCookies } from "./hasAmbiguousSessionCookies";

describe(hasAmbiguousSessionCookies.name, () => {
  it.each([
    ["a whole session cookie", "theme=dark; appSession=abc"],
    ["one set of session chunks", "appSession.0=abc; appSession.1=def; appSession.10=ghi"],
    ["cookies whose names only contain the session cookie name", "appSession=abc; appSessionDraft=x; old_appSession=y; appSession.x=z"],
    ["no session cookie", "theme=dark"],
    ["no cookie header", undefined]
  ])("is false for %s", (_, cookieHeader) => {
    expect(hasAmbiguousSessionCookies(cookieHeader)).toBe(false);
  });

  it.each([
    ["a whole session cookie sent twice", "appSession=abc; theme=dark; appSession=xyz"],
    ["a session chunk sent twice", "appSession.0=abc; appSession.1=def; appSession.0=xyz"],
    ["a two-digit session chunk sent twice", "appSession.10=abc; appSession.10=xyz"],
    ["a whole session cookie alongside session chunks", "appSession.0=abc; appSession.1=def; appSession=xyz"]
  ])("is true for %s", (_, cookieHeader) => {
    expect(hasAmbiguousSessionCookies(cookieHeader)).toBe(true);
  });
});
