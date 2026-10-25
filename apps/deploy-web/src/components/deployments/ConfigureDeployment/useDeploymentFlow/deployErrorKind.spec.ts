import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it } from "vitest";

import { canLeaseElsewhere, deployErrorKindOf } from "./deployErrorKind";

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
});

describe(canLeaseElsewhere.name, () => {
  it.each([
    ["the provider could not be reached", 502, "provider_unreachable"],
    ["its transaction expired before it landed", 502, "tx_not_included"],
    ["the chain refused it", 400, "bad_request"]
  ])("allows another provider once the lease failed because %s", (_, status, code) => {
    expect(canLeaseElsewhere(apiError(status, { code }))).toBe(true);
  });

  it.each([
    ["its transaction may still land", 504, "tx_outcome_unknown"],
    ["the lease landed but the provider refused the manifest", 502, "manifest_not_delivered"],
    ["the lease landed but the provider rejected the manifest as invalid", 400, "manifest_not_delivered"],
    ["the user has to pay their way out of it", 402, "payment_required"],
    ["another request is already leasing the deployment", 409, "conflict"],
    ["the api failed without ruling out the lease", 500, "internal_server_error"]
  ])("keeps the provider when the lease failed because %s", (_, status, code) => {
    expect(canLeaseElsewhere(apiError(status, { code }))).toBe(false);
  });

  it("keeps the provider when a gateway gave up before the api answered", () => {
    expect(canLeaseElsewhere(apiError(504, "<html>Gateway Timeout</html>"))).toBe(false);
  });

  it("keeps the provider when the failure did not come from the api, even with a refusal's status", () => {
    expect(canLeaseElsewhere(Object.assign(new TypeError("Failed to fetch"), { status: 400 }))).toBe(false);
  });
});

function apiError(status: number, body: unknown) {
  return new ApiError(status, body, `POST /v1/leases → ${status}`);
}
