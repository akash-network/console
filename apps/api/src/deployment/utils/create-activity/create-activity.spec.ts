import createError from "http-errors";
import { describe, expect, it } from "vitest";

import { TxNotIncludedError, TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { createdActivityOf, creatingActivityOf, failedCreateActivityOf, isCreateRefusal, notCreatedActivityOf } from "./create-activity";

describe("create activity", () => {
  const KEY = { userId: "c0ffee00-0000-4000-8000-000000000001", dseq: "1748400000000" };
  const ACCEPTED = { ...KEY, walletId: 7, message: "Cg1hY2NlcHRlZA==" };

  describe(creatingActivityOf.name, () => {
    it("opens the create as pending for the deployment it creates, carrying nothing of the accepted message", () => {
      expect(creatingActivityOf(ACCEPTED)).toEqual({
        userId: KEY.userId,
        type: "deployment_create",
        status: "pending",
        initiator: "user",
        meta: { dseq: KEY.dseq },
        dedupeKey: null
      });
    });
  });

  describe(createdActivityOf.name, () => {
    it("records the create as succeeded for the deployment it created, carrying nothing of the accepted message", () => {
      expect(createdActivityOf(ACCEPTED)).toEqual({
        userId: KEY.userId,
        type: "deployment_create",
        status: "succeeded",
        initiator: "user",
        meta: { dseq: KEY.dseq },
        dedupeKey: null
      });
    });
  });

  describe(notCreatedActivityOf.name, () => {
    it("records the create as failed with a reason that asks for another create", () => {
      expect(notCreatedActivityOf(ACCEPTED)).toEqual({
        userId: KEY.userId,
        type: "deployment_create",
        status: "failed",
        initiator: "user",
        meta: { dseq: KEY.dseq, error: { code: "create_incomplete", message: "The deployment was not created. Try creating it again." } },
        dedupeKey: null
      });
    });
  });

  describe(failedCreateActivityOf.name, () => {
    it("records a create whose outcome is undecided as pending under its hash", () => {
      expect(failedCreateActivityOf(ACCEPTED, new TxOutcomeUnknownError("ABCDEF"))).toEqual({
        userId: KEY.userId,
        type: "deployment_create",
        status: "pending",
        initiator: "user",
        meta: { dseq: KEY.dseq, txHash: "ABCDEF" },
        dedupeKey: null
      });
    });

    it("records a create that never landed as failed with the reason the caller was given", () => {
      expect(failedCreateActivityOf(ACCEPTED, new TxNotIncludedError("ABCDEF"))).toEqual({
        userId: KEY.userId,
        type: "deployment_create",
        status: "failed",
        initiator: "user",
        meta: { dseq: KEY.dseq, error: { code: "tx_not_included", message: "The request expired and can no longer complete" } },
        dedupeKey: null
      });
    });

    it.each([
      { kind: "an unexplained failure", error: new Error("socket hang up") },
      { kind: "an internal error", error: createError(500, "connection to 10.0.0.4 refused") },
      { kind: "a server error exposed to the caller", error: createError(500, "The signer is restarting", { expose: true }) },
      { kind: "a client error not meant for the caller", error: createError(400, "Invalid nonce", { expose: false }) }
    ])("leaves a create that met $kind pending for the chain to decide, carrying nothing of the error", ({ error }) => {
      expect(failedCreateActivityOf(ACCEPTED, error)).toEqual({
        userId: KEY.userId,
        type: "deployment_create",
        status: "pending",
        initiator: "user",
        meta: { dseq: KEY.dseq },
        dedupeKey: null
      });
    });

    it("records a refusal with the code it carries", () => {
      expect(failedCreateActivityOf(ACCEPTED, createError(402, "Not enough credits", { errorCode: "insufficient_balance" })).meta.error).toEqual({
        code: "insufficient_balance",
        message: "Not enough credits"
      });
    });

    it("falls back to its own code for an exposed error that names none", () => {
      expect(failedCreateActivityOf(ACCEPTED, createError(400, "Deployment with provided dseq and owner already exists")).meta.error).toEqual({
        code: "create_failed",
        message: "Deployment with provided dseq and owner already exists"
      });
    });
  });

  describe(isCreateRefusal.name, () => {
    it.each([
      { kind: "a client error meant for the caller", error: createError(402, "Not enough credits"), isRefusal: true },
      { kind: "the last client error status", error: createError(499, "Client closed request"), isRefusal: true },
      { kind: "a server error exposed to the caller", error: createError(500, "The signer is restarting", { expose: true }), isRefusal: false },
      { kind: "a client error not meant for the caller", error: createError(400, "Invalid nonce", { expose: false }), isRefusal: false },
      { kind: "a create proven never included", error: new TxNotIncludedError("ABCDEF"), isRefusal: false },
      { kind: "an undecided outcome", error: new TxOutcomeUnknownError("ABCDEF"), isRefusal: false },
      { kind: "an error that is not an HTTP error", error: new Error("socket hang up"), isRefusal: false }
    ])("answers $isRefusal for $kind", ({ error, isRefusal }) => {
      expect(isCreateRefusal(error)).toBe(isRefusal);
    });
  });
});
