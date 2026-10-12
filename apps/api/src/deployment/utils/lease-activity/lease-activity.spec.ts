import createError from "http-errors";
import { describe, expect, it } from "vitest";

import { TxNotIncludedError, TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import {
  createdLeaseActivityOf,
  failedLeaseActivityOf,
  notCreatedLeaseActivityOf,
  pendingLeaseActivityOf,
  undeliveredManifestActivityOf
} from "./lease-activity";

describe("lease activity", () => {
  const PROVIDER_A = "akash1providera";
  const PROVIDER_B = "akash1providerb";
  const KEY = {
    userId: "user-1",
    leases: [
      { dseq: "100", gseq: 1, oseq: 1, provider: PROVIDER_A },
      { dseq: "100", gseq: 2, oseq: 1, provider: PROVIDER_B },
      { dseq: "100", gseq: 3, oseq: 1, provider: PROVIDER_A }
    ]
  };
  const META = { dseq: "100", providers: [PROVIDER_A, PROVIDER_B] };

  it("opens a pending lease creation naming the deployment and each provider once", () => {
    expect(pendingLeaseActivityOf(KEY)).toEqual({ userId: "user-1", type: "lease_create", status: "pending", meta: META });
  });

  it("records leases created with their manifest sent as succeeded", () => {
    expect(createdLeaseActivityOf(KEY)).toEqual({ userId: "user-1", type: "lease_create", status: "succeeded", meta: META });
  });

  it("records leases the chain never got as failed, telling the user to choose a provider again", () => {
    expect(notCreatedLeaseActivityOf(KEY)).toEqual({
      userId: "user-1",
      type: "lease_create",
      status: "failed",
      meta: { ...META, error: { code: "lease_not_created", message: "The lease was not created. Choose a provider again." } }
    });
  });

  it("records leases that landed without their manifest as failed, telling the user how to finish", () => {
    expect(undeliveredManifestActivityOf(KEY)).toEqual({
      userId: "user-1",
      type: "lease_create",
      status: "failed",
      meta: {
        ...META,
        error: {
          code: "manifest_not_delivered",
          message:
            "The lease for deployment 100 exists, but its manifest was not sent. Send the lease request again to finish, or close the deployment to stop paying for it."
        }
      }
    });
  });

  describe(failedLeaseActivityOf.name, () => {
    it("keeps a lease whose outcome is undecided pending under its hash", () => {
      expect(failedLeaseActivityOf(KEY, new TxOutcomeUnknownError("ABCDEF"))).toEqual({
        userId: "user-1",
        type: "lease_create",
        status: "pending",
        meta: { ...META, txHash: "ABCDEF" }
      });
    });

    it("explains a failure by the code and message its error carries, whatever its status", () => {
      const error = createError(502, "Provider akash1 could not be reached", { errorCode: "provider_unreachable" });

      expect(failedLeaseActivityOf(KEY, error)).toEqual({
        userId: "user-1",
        type: "lease_create",
        status: "failed",
        meta: { ...META, error: { code: "provider_unreachable", message: "Provider akash1 could not be reached" } }
      });
    });

    it("prefers the code a chain error carries in its data", () => {
      const error = createError(400, "Insufficient funds", { errorCode: "outer", data: { errorCode: "insufficient_funds" } });

      expect(failedLeaseActivityOf(KEY, error).meta.error).toEqual({ code: "insufficient_funds", message: "Insufficient funds" });
    });

    it("explains a transaction proven not to land by its own code", () => {
      expect(failedLeaseActivityOf(KEY, new TxNotIncludedError("ABCDEF")).meta.error).toEqual({
        code: "tx_not_included",
        message: "The request expired and can no longer complete"
      });
    });

    it("explains a refusal carrying no code by its message", () => {
      expect(failedLeaseActivityOf(KEY, createError(400, "The selected bid is no longer open")).meta.error).toEqual({
        code: "lease_create_failed",
        message: "The selected bid is no longer open"
      });
    });

    it.each([
      { failure: "a server error carrying no code", error: createError(500, "connection pool exhausted") },
      { failure: "a failure that is not an http error", error: new Error("socket hang up") }
    ])("keeps the message of $failure to the logs", ({ error }) => {
      expect(failedLeaseActivityOf(KEY, error)).toEqual({
        userId: "user-1",
        type: "lease_create",
        status: "failed",
        meta: { ...META, error: { code: "lease_create_failed", message: "Something went wrong on our side. Choose a provider again in a moment." } }
      });
    });
  });
});
