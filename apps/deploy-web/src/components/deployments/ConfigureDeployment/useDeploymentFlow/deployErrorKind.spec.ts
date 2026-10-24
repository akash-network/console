import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it } from "vitest";

import { deployErrorKindOf } from "./deployErrorKind";

describe(deployErrorKindOf.name, () => {
  it.each([
    ["the provider could not be reached", 502, "provider_unreachable"],
    ["the provider never received the manifest", 500, "manifest_not_delivered"]
  ])("reads a lease refused because %s as provider_unreachable", (_, status, code) => {
    expect(deployErrorKindOf(apiError(status, { code }))).toBe("provider_unreachable");
  });

  it.each([
    ["may still land", 504, "tx_outcome_unknown"],
    ["expired before it landed", 502, "tx_not_included"]
  ])("reads a transaction that %s as a timeout", (_, status, code) => {
    expect(deployErrorKindOf(apiError(status, { code }))).toBe("timeout");
  });

  it.each([408, 504])("reads a gateway that gave up with a %i and no error code as a timeout", status => {
    expect(deployErrorKindOf(apiError(status, "<html>Gateway Timeout</html>"))).toBe("timeout");
  });

  it("reads a refusal the user has to pay their way out of as insufficient_funds", () => {
    expect(deployErrorKindOf(apiError(402, { code: "payment_required" }))).toBe("insufficient_funds");
  });

  it.each([
    [400, "bad_request"],
    [500, "internal_server_error"],
    [503, "service_unavailable"]
  ])("reads any other %i the api answers with as a chain_error", (status, code) => {
    expect(deployErrorKindOf(apiError(status, { code }))).toBe("chain_error");
  });

  it("reads a failure the api never answered as unknown", () => {
    expect(deployErrorKindOf(new TypeError("Failed to fetch"))).toBe("unknown");
  });

  function apiError(status: number, body: unknown) {
    return new ApiError(status, body, `POST /v1/leases → ${status}`);
  }
});
