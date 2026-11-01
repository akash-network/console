import { describe, expect, it } from "vitest";

import { isWriteFromAnotherOrigin } from "./isWriteFromAnotherOrigin";

describe(isWriteFromAnotherOrigin.name, () => {
  it.each(["GET", "HEAD", "OPTIONS"])("lets a %s request through whatever site sent it", method => {
    expect(isWriteFromAnotherOrigin({ method, headers: { "sec-fetch-site": "cross-site", origin: "https://other.example" } })).toBe(false);
  });

  it("lets a write through when the browser marks it same-origin", () => {
    expect(isWriteFromAnotherOrigin({ method: "POST", headers: { "sec-fetch-site": "same-origin" } })).toBe(false);
  });

  it.each(["same-site", "cross-site", "none"])("refuses a write the browser marks %s", fetchSite => {
    expect(isWriteFromAnotherOrigin({ method: "POST", headers: { "sec-fetch-site": fetchSite } })).toBe(true);
  });

  it("trusts the browser's fetch site over the origin it sends", () => {
    expect(
      isWriteFromAnotherOrigin({
        method: "DELETE",
        headers: { "sec-fetch-site": "same-site", origin: "https://console.akash.network", host: "console.akash.network" }
      })
    ).toBe(true);
  });

  it("refuses a write that names no method when another site sent it", () => {
    expect(isWriteFromAnotherOrigin({ headers: { "sec-fetch-site": "cross-site" } })).toBe(true);
  });

  it("lets a write through that carries neither a fetch site nor an origin", () => {
    expect(isWriteFromAnotherOrigin({ method: "POST", headers: { host: "console.akash.network" } })).toBe(false);
  });

  it("lets a write through whose origin matches the host it was sent to", () => {
    expect(isWriteFromAnotherOrigin({ method: "POST", headers: { origin: "https://console.akash.network", host: "console.akash.network" } })).toBe(false);
  });

  it("refuses a write whose origin is another host", () => {
    expect(isWriteFromAnotherOrigin({ method: "PUT", headers: { origin: "https://stats.akash.network", host: "console.akash.network" } })).toBe(true);
  });

  it("refuses a write whose origin is the same host on another port", () => {
    expect(isWriteFromAnotherOrigin({ method: "POST", headers: { origin: "http://localhost:3001", host: "localhost:3000" } })).toBe(true);
  });

  it("refuses a write whose origin is opaque", () => {
    expect(isWriteFromAnotherOrigin({ method: "POST", headers: { origin: "null", host: "console.akash.network" } })).toBe(true);
  });

  it("compares the origin with the forwarded host rather than the proxy-facing one", () => {
    expect(
      isWriteFromAnotherOrigin({
        method: "POST",
        headers: { origin: "https://console.akash.network", host: "deploy-web.internal:3000", "x-forwarded-host": "console.akash.network" }
      })
    ).toBe(false);
  });

  it("refuses a write whose origin matches only the proxy-facing host", () => {
    expect(
      isWriteFromAnotherOrigin({
        method: "POST",
        headers: { origin: "https://deploy-web.internal:3000", host: "deploy-web.internal:3000", "x-forwarded-host": "console.akash.network" }
      })
    ).toBe(true);
  });

  it("uses the first host of a forwarded host list", () => {
    expect(
      isWriteFromAnotherOrigin({
        method: "POST",
        headers: { origin: "https://console.akash.network", host: "deploy-web.internal", "x-forwarded-host": "console.akash.network , deploy-web.internal" }
      })
    ).toBe(false);
  });

  it("uses the first of repeated forwarded host headers", () => {
    expect(
      isWriteFromAnotherOrigin({
        method: "POST",
        headers: { origin: "https://console.akash.network", host: "deploy-web.internal", "x-forwarded-host": ["console.akash.network", "deploy-web.internal"] }
      })
    ).toBe(false);
  });

  it("falls back to the host when the forwarded host is empty", () => {
    expect(
      isWriteFromAnotherOrigin({ method: "POST", headers: { origin: "https://console.akash.network", host: "console.akash.network", "x-forwarded-host": "" } })
    ).toBe(false);
  });
});
