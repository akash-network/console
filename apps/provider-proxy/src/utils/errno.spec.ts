import { describe, expect, it } from "vitest";

import { toErrno, toProviderErrorCategory } from "./errno";

describe("toErrno", () => {
  it("reads the code off an ErrnoException", () => {
    expect(toErrno(Object.assign(new Error("connect EHOSTUNREACH"), { code: "EHOSTUNREACH" }))).toBe("EHOSTUNREACH");
  });

  it("returns undefined for an error without a code", () => {
    expect(toErrno(new Error("boom"))).toBeUndefined();
  });

  it("returns undefined for a non-string code", () => {
    expect(toErrno(Object.assign(new Error("boom"), { code: 42 }))).toBeUndefined();
  });

  it.each([null, undefined, "EHOSTUNREACH"])("returns undefined for %s", value => {
    expect(toErrno(value)).toBeUndefined();
  });
});

describe("toProviderErrorCategory", () => {
  it.each(["ERR_SSL_WRONG_VERSION_NUMBER", "ERR_SSL_PACKET_LENGTH_TOO_LONG"])("classifies %s as a client certificate error", errno => {
    expect(toProviderErrorCategory(errno)).toBe("clientCertificateError");
  });

  it("classifies the private-network guard rejection as a blocked address", () => {
    expect(toProviderErrorCategory("EFORBIDDEN")).toBe("blockedAddress");
  });

  it.each(["EHOSTUNREACH", "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", undefined])("classifies %s as the provider being unreachable", errno => {
    expect(toProviderErrorCategory(errno)).toBe("providerUnreachable");
  });
});
