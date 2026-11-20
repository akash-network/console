import { describe, expect, it } from "vitest";

import { isForwardingOnly } from "./mail-forwarding";

describe(isForwardingOnly.name, () => {
  it("accepts mail hosts that all belong to a forwarding service", () => {
    expect(isForwardingOnly(["route1.mx.cloudflare.net", "route2.mx.cloudflare.net"])).toBe(true);
    expect(isForwardingOnly(["mx1.improvmx.com"])).toBe(true);
    expect(isForwardingOnly(["mx1.forwardemail.net"])).toBe(true);
  });

  it("rejects a domain whose mail reaches a host outside the forwarding services", () => {
    expect(isForwardingOnly(["route1.mx.cloudflare.net", "aspmx.l.google.com"])).toBe(false);
    expect(isForwardingOnly(["mail.step-sis.help"])).toBe(false);
  });

  it("rejects lookalike hosts that only end with a forwarder's name", () => {
    expect(isForwardingOnly(["evilmx.cloudflare.net"])).toBe(false);
    expect(isForwardingOnly(["notimprovmx.com"])).toBe(false);
  });

  it("rejects a domain without mail hosts", () => {
    expect(isForwardingOnly([])).toBe(false);
  });
});
