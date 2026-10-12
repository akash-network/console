import createError from "http-errors";
import { describe, expect, it } from "vitest";

import { TxNotIncludedError, TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { failedUpdateActivityOf, notAppliedUpdateActivityOf, pendingUpdateActivityOf, undeliveredUpdateActivityOf, updatedActivityOf } from "./update-activity";

describe("update activity", () => {
  const KEY = { userId: "c0ffee00-0000-4000-8000-000000000001", dseq: "1234", manifestVersion: "U0FWRUQ=" };

  describe(pendingUpdateActivityOf.name, () => {
    it("opens the update as pending under the version it saved", () => {
      expect(pendingUpdateActivityOf(KEY)).toEqual({
        userId: KEY.userId,
        type: "deployment_update",
        status: "pending",
        meta: { dseq: "1234", manifestVersion: "U0FWRUQ=" }
      });
    });
  });

  describe(updatedActivityOf.name, () => {
    it("records the update as succeeded under the version it saved", () => {
      expect(updatedActivityOf(KEY)).toEqual({
        userId: KEY.userId,
        type: "deployment_update",
        status: "succeeded",
        meta: { dseq: "1234", manifestVersion: "U0FWRUQ=" }
      });
    });
  });

  describe(failedUpdateActivityOf.name, () => {
    it("keeps an update whose outcome is undecided pending under its hash", () => {
      expect(failedUpdateActivityOf(KEY, new TxOutcomeUnknownError("ABCDEF"))).toEqual({
        userId: KEY.userId,
        type: "deployment_update",
        status: "pending",
        meta: { dseq: "1234", manifestVersion: "U0FWRUQ=", txHash: "ABCDEF" }
      });
    });

    it("records an update that never landed as failed with the reason the caller was given", () => {
      expect(failedUpdateActivityOf(KEY, new TxNotIncludedError("ABCDEF"))).toEqual({
        userId: KEY.userId,
        type: "deployment_update",
        status: "failed",
        meta: { dseq: "1234", manifestVersion: "U0FWRUQ=", error: { code: "tx_not_included", message: "The request expired and can no longer complete" } }
      });
    });

    it("keeps the message of an exposed error under a generic code when it names none", () => {
      expect(failedUpdateActivityOf(KEY, createError(400, "Deployment closed")).meta.error).toEqual({ code: "update_failed", message: "Deployment closed" });
    });

    it("hides the message of an error not meant for the caller", () => {
      expect(failedUpdateActivityOf(KEY, new Error("socket hang up")).meta.error).toEqual({
        code: "update_failed",
        message: "Something went wrong while applying the update. Try updating it again in a moment."
      });
    });
  });

  describe(notAppliedUpdateActivityOf.name, () => {
    it("records the update as failed with a reason that asks for another update", () => {
      expect(notAppliedUpdateActivityOf(KEY)).toEqual({
        userId: KEY.userId,
        type: "deployment_update",
        status: "failed",
        meta: {
          dseq: "1234",
          manifestVersion: "U0FWRUQ=",
          error: { code: "update_incomplete", message: "The update did not go through. Try updating it again." }
        }
      });
    });
  });

  describe(undeliveredUpdateActivityOf.name, () => {
    it("records the update as failed with a reason that says the provider may not have it", () => {
      expect(undeliveredUpdateActivityOf(KEY)).toEqual({
        userId: KEY.userId,
        type: "deployment_update",
        status: "failed",
        meta: {
          dseq: "1234",
          manifestVersion: "U0FWRUQ=",
          error: {
            code: "update_not_delivered",
            message: "The update reached the network, but your provider may not have received it. Try updating it again."
          }
        }
      });
    });
  });
});
