import createError from "http-errors";
import { describe, expect, it } from "vitest";

import { TxNotIncludedError, TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { createdActivityOf, creatingActivityOf, failedCreateActivityOf, notCreatedActivityOf } from "./create-activity";

describe("create activity", () => {
  const KEY = { userId: "c0ffee00-0000-4000-8000-000000000001", dseq: "1748400000000" };
  const ACCEPTED = { ...KEY, message: "Cg1hY2NlcHRlZA==" };

  describe(creatingActivityOf.name, () => {
    it("opens the create as pending for the deployment it creates, carrying nothing of the accepted message", () => {
      expect(creatingActivityOf(ACCEPTED)).toEqual({ userId: KEY.userId, type: "deployment_create", status: "pending", meta: { dseq: KEY.dseq } });
    });
  });

  describe(createdActivityOf.name, () => {
    it("records the create as succeeded for the deployment it created, carrying nothing of the accepted message", () => {
      expect(createdActivityOf(ACCEPTED)).toEqual({ userId: KEY.userId, type: "deployment_create", status: "succeeded", meta: { dseq: KEY.dseq } });
    });
  });

  describe(notCreatedActivityOf.name, () => {
    it("records the create as failed with a reason that asks for another create", () => {
      expect(notCreatedActivityOf(ACCEPTED)).toEqual({
        userId: KEY.userId,
        type: "deployment_create",
        status: "failed",
        meta: { dseq: KEY.dseq, error: { code: "create_incomplete", message: "The deployment was not created. Try creating it again." } }
      });
    });
  });

  describe(failedCreateActivityOf.name, () => {
    it("records a create whose outcome is undecided as pending under its hash", () => {
      expect(failedCreateActivityOf(ACCEPTED, new TxOutcomeUnknownError("ABCDEF"))).toEqual({
        userId: KEY.userId,
        type: "deployment_create",
        status: "pending",
        meta: { dseq: KEY.dseq, txHash: "ABCDEF" }
      });
    });

    it("records a create that never landed as failed with the reason the caller was given", () => {
      expect(failedCreateActivityOf(ACCEPTED, new TxNotIncludedError("ABCDEF"))).toEqual({
        userId: KEY.userId,
        type: "deployment_create",
        status: "failed",
        meta: { dseq: KEY.dseq, error: { code: "tx_not_included", message: "The request expired and can no longer complete" } }
      });
    });

    it("hides the message of an error not meant for the caller behind one of its own", () => {
      expect(failedCreateActivityOf(ACCEPTED, new Error("socket hang up")).meta.error).toEqual({
        code: "create_failed",
        message: "Something went wrong on our side. Try creating it again in a moment."
      });
    });

    it("falls back to its own code for an exposed error that names none", () => {
      expect(failedCreateActivityOf(ACCEPTED, createError(400, "Deployment with provided dseq and owner already exists")).meta.error).toEqual({
        code: "create_failed",
        message: "Deployment with provided dseq and owner already exists"
      });
    });
  });
});
