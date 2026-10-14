import createError from "http-errors";
import { describe, expect, it } from "vitest";

import { TxNotIncludedError, TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { closedActivityOf, failedCloseActivityOf, pendingCloseActivityOf, stillOpenActivityOf, systemClosedActivityOf } from "./close-activity";

describe("close activity", () => {
  const KEY = { userId: "c0ffee00-0000-4000-8000-000000000001", owner: "akash1owner", dseq: "1234" };
  const BATCH_ID = "b47c4a2e-5f0d-4c1e-9a7b-2d3e4f5a6b7c";
  const DEDUPE_KEY = "deployment_close.akash1owner.1234";

  describe(pendingCloseActivityOf.name, () => {
    it("opens the user's close as pending under the key every report of the deployment's close shares", () => {
      expect(pendingCloseActivityOf(KEY)).toEqual({
        userId: KEY.userId,
        type: "deployment_close",
        status: "pending",
        initiator: "user",
        meta: { dseq: "1234" },
        dedupeKey: DEDUPE_KEY
      });
    });

    it("carries the bulk close the close is part of", () => {
      expect(pendingCloseActivityOf({ ...KEY, batchId: BATCH_ID }).meta).toEqual({ dseq: "1234", batchId: BATCH_ID });
    });
  });

  describe(closedActivityOf.name, () => {
    it("records the user's close as succeeded for the deployment it closed, under the deployment's close key", () => {
      expect(closedActivityOf(KEY)).toEqual({
        userId: KEY.userId,
        type: "deployment_close",
        status: "succeeded",
        initiator: "user",
        meta: { dseq: "1234" },
        dedupeKey: DEDUPE_KEY
      });
    });

    it("carries the bulk close the close was part of", () => {
      expect(closedActivityOf({ ...KEY, batchId: BATCH_ID }).meta).toEqual({ dseq: "1234", batchId: BATCH_ID });
    });
  });

  describe(systemClosedActivityOf.name, () => {
    it.each(["runtime_limit_reached", "trial_ended", "provider_unreachable", "no_lease"] as const)(
      "records a close Console made because of %s as Console's, under the same key as the user's own close",
      reason => {
        expect(systemClosedActivityOf({ ...KEY, reason })).toEqual({
          userId: KEY.userId,
          type: "deployment_close",
          status: "succeeded",
          initiator: "system",
          meta: { dseq: "1234", reason },
          dedupeKey: closedActivityOf(KEY).dedupeKey
        });
      }
    );

    it("keys a close of another owner's deployment with the same dseq apart from it", () => {
      expect(systemClosedActivityOf({ ...KEY, owner: "akash1team", reason: "no_lease" }).dedupeKey).not.toBe(closedActivityOf(KEY).dedupeKey);
    });
  });

  describe(stillOpenActivityOf.name, () => {
    it("records the close as failed with a reason that asks for another close, giving up the key so that close can record itself", () => {
      expect(stillOpenActivityOf(KEY)).toEqual({
        userId: KEY.userId,
        type: "deployment_close",
        status: "failed",
        initiator: "user",
        meta: { dseq: "1234", error: { code: "close_incomplete", message: "The deployment is still open. Try closing it again." } },
        dedupeKey: null
      });
    });

    it("carries the bulk close the close was part of", () => {
      expect(stillOpenActivityOf({ ...KEY, batchId: BATCH_ID }).meta).toMatchObject({ dseq: "1234", batchId: BATCH_ID });
    });
  });

  describe(failedCloseActivityOf.name, () => {
    it("records a close whose outcome is undecided as pending under its hash, keeping the deployment's close key", () => {
      expect(failedCloseActivityOf(KEY, new TxOutcomeUnknownError("ABCDEF"))).toEqual({
        userId: KEY.userId,
        type: "deployment_close",
        status: "pending",
        initiator: "user",
        meta: { dseq: "1234", txHash: "ABCDEF" },
        dedupeKey: DEDUPE_KEY
      });
    });

    it("records a close that never landed as failed with the reason the caller was given, without the key", () => {
      expect(failedCloseActivityOf(KEY, new TxNotIncludedError("ABCDEF"))).toEqual({
        userId: KEY.userId,
        type: "deployment_close",
        status: "failed",
        initiator: "user",
        meta: { dseq: "1234", error: { code: "tx_not_included", message: "The request expired and can no longer complete" } },
        dedupeKey: null
      });
    });

    it.each([
      { status: "pending", error: new TxOutcomeUnknownError("ABCDEF") },
      { status: "failed", error: new TxNotIncludedError("ABCDEF") }
    ])("carries the bulk close into a close recorded as $status", ({ error }) => {
      expect(failedCloseActivityOf({ ...KEY, batchId: BATCH_ID }, error).meta).toMatchObject({ dseq: "1234", batchId: BATCH_ID });
    });

    it("takes the code an error carries in its data over its own", () => {
      const error = Object.assign(createError(402, "Not enough credits to close this deployment"), {
        errorCode: "outer_code",
        data: { errorCode: "insufficient_balance" }
      });

      expect(failedCloseActivityOf(KEY, error).meta.error).toEqual({ code: "insufficient_balance", message: "Not enough credits to close this deployment" });
    });

    it("falls back to a generic code for an exposed error that names none", () => {
      expect(failedCloseActivityOf(KEY, createError(400, "Deployment is not open")).meta.error).toEqual({
        code: "close_failed",
        message: "Deployment is not open"
      });
    });

    it("hides the message of an error not meant for the caller", () => {
      expect(failedCloseActivityOf(KEY, createError(500, "connection to 10.0.0.4 refused")).meta.error).toEqual({
        code: "close_failed",
        message: "Something went wrong on our side. Try closing it again in a moment."
      });
    });

    it("hides the message of an error that is not an HTTP error", () => {
      expect(failedCloseActivityOf(KEY, new Error("socket hang up")).meta.error).toEqual({
        code: "close_failed",
        message: "Something went wrong on our side. Try closing it again in a moment."
      });
    });
  });
});
