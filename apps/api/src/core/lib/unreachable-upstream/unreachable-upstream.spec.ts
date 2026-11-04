import { SDKError } from "@akashnetwork/chain-sdk/web";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";

import { isUnreachableUpstreamError } from "./unreachable-upstream";

describe(isUnreachableUpstreamError.name, () => {
  it.each(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"])("recognizes an http request that failed with %s", code => {
    expect(isUnreachableUpstreamError(new AxiosError(`connect ${code}`, code))).toBe(true);
  });

  it("recognizes an http request failure wrapped by the caller", () => {
    const error = new Error("Failed to sign", { cause: new AxiosError("connect ECONNREFUSED", "ECONNREFUSED") });

    expect(isUnreachableUpstreamError(error)).toBe(true);
  });

  it("recognizes a chain request whose fetch could not connect", () => {
    const error = SDKError.from(new TypeError("fetch failed", { cause: socketError("ECONNREFUSED") }));

    expect(isUnreachableUpstreamError(error)).toBe(true);
  });

  it.each(["ETIMEDOUT", "ECONNRESET"])("leaves an http request that failed with %s after connecting unrecognized", code => {
    expect(isUnreachableUpstreamError(new AxiosError(`socket ${code}`, code))).toBe(false);
  });

  it("leaves an http request that the upstream answered with an error unrecognized", () => {
    const error = new AxiosError("Request failed with status code 500", AxiosError.ERR_BAD_RESPONSE, undefined, undefined, {
      status: 500,
      statusText: "Internal Server Error",
      data: {},
      headers: {},
      config: { headers: new AxiosHeaders() }
    });

    expect(isUnreachableUpstreamError(error)).toBe(false);
  });

  it("leaves a chain request that failed for another reason unrecognized", () => {
    expect(isUnreachableUpstreamError(SDKError.from(new TypeError("fetch failed", { cause: new Error("other side closed") })))).toBe(false);
  });

  it("leaves a refused connection outside an http or chain client unrecognized", () => {
    const error = new Error("Failed query", { cause: socketError("ECONNREFUSED") });

    expect(isUnreachableUpstreamError(error)).toBe(false);
  });

  it("stops at a cause chain that loops back on itself", () => {
    const error = new Error("first");
    error.cause = new Error("second", { cause: error });

    expect(isUnreachableUpstreamError(error)).toBe(false);
  });

  it.each([undefined, "ECONNREFUSED", { code: "ECONNREFUSED" }])("leaves the non-error value %o unrecognized", value => {
    expect(isUnreachableUpstreamError(value)).toBe(false);
  });

  function socketError(code: string) {
    return Object.assign(new Error(`connect ${code} 127.0.0.1:443`), { code });
  }
});
