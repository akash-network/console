import createError from "http-errors";
import { describe, expect, it } from "vitest";

import { TxNotIncludedError, TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { closedActivityOf, failedCloseActivityOf, stillOpenActivityOf } from "./close-activity";

describe("close activity", () => {
  const KEY = { userId: "c0ffee00-0000-4000-8000-000000000001", dseq: "1234" };
  const BATCH_ID = "b47c4a2e-5f0d-4c1e-9a7b-2d3e4f5a6b7c";

  describe(closedActivityOf.name, () => {
    it("records the close as succeeded for the deployment it closed", () => {
      expect(closedActivityOf(KEY)).toEqual({
        userId: KEY.userId,
        type: "deployment_close",
        status: "succeeded",
        meta: { dseq: "1234" }
      });
    });

    it("carries the bulk close the close was part of", () => {
      expect(closedActivityOf({ ...KEY, batchId: BATCH_ID }).meta).toEqual({ dseq: "1234", batchId: BATCH_ID });
    });
  });

  describe(stillOpenActivityOf.name, () => {
    it("records the close as failed with a reason that asks for another close", () => {
      expect(stillOpenActivityOf(KEY)).toEqual({
        userId: KEY.userId,
        type: "deployment_close",
        status: "failed",
        meta: { dseq: "1234", error: { code: "close_incomplete", message: "The deployment is still open. Try closing it again." } }
      });
    });

    it("carries the bulk close the close was part of", () => {
      expect(stillOpenActivityOf({ ...KEY, batchId: BATCH_ID }).meta).toMatchObject({ dseq: "1234", batchId: BATCH_ID });
    });
  });

  describe(failedCloseActivityOf.name, () => {
    it("records a close whose outcome is undecided as pending under its hash", () => {
      expect(failedCloseActivityOf(KEY, new TxOutcomeUnknownError("ABCDEF"))).toEqual({
        userId: KEY.userId,
        type: "deployment_close",
        status: "pending",
        meta: { dseq: "1234", txHash: "ABCDEF" }
      });
    });

    it("records a close that never landed as failed with the reason the caller was given", () => {
      expect(failedCloseActivityOf(KEY, new TxNotIncludedError("ABCDEF"))).toEqual({
        userId: KEY.userId,
        type: "deployment_close",
        status: "failed",
        meta: { dseq: "1234", error: { code: "tx_not_included", message: "The request expired and can no longer complete" } }
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
        message: "The deployment could not be closed."
      });
    });

    it("hides the message of an error that is not an HTTP error", () => {
      expect(failedCloseActivityOf(KEY, new Error("socket hang up")).meta.error).toEqual({
        code: "close_failed",
        message: "The deployment could not be closed."
      });
    });
  });
});
