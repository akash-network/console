import { MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { Registry } from "@cosmjs/proto-signing";
import nock from "nock";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { CreateLogger } from "@src/core";
import { ExternalSignerHttpSdkService } from "./external-signer-http-sdk.service";
import { TxNotIncludedError, TxOutcomeUnknownError } from "./tx-outcome.error";

const BASE_URL = "http://tx-signer.test";
const CLOSED_PORT_URL = "http://127.0.0.1:1";

describe(ExternalSignerHttpSdkService.name, () => {
  it("returns the landed transaction the signer reports", async () => {
    const { service } = setup();
    nock(BASE_URL)
      .post("/v1/tx/derived")
      .reply(200, { data: { code: 0, hash: "ABC123", rawLog: "" } });

    const result = await service.signAndBroadcastWithDerivedWallet(1, messages());

    expect(result).toEqual({ code: 0, hash: "ABC123", rawLog: "" });
  });

  it("raises a not-included outcome with its hash when the signer proves the transaction expired", async () => {
    const { service } = setup();
    nock(BASE_URL)
      .post("/v1/tx/derived")
      .reply(502, { message: "expired", data: { outcome: "not_included", txHash: "ABC123" } });

    const error = await service.signAndBroadcastWithDerivedWallet(1, messages()).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(TxNotIncludedError);
    expect((error as TxNotIncludedError).txHash).toBe("ABC123");
  });

  it("raises an undecided outcome with its hash when the signer could not decide", async () => {
    const { service } = setup();
    nock(BASE_URL)
      .post("/v1/tx/derived")
      .reply(504, { message: "undecided", data: { outcome: "unknown", txHash: "ABC123" } });

    const error = await service.signAndBroadcastWithDerivedWallet(1, messages()).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(TxOutcomeUnknownError);
    expect((error as TxOutcomeUnknownError).txHash).toBe("ABC123");
  });

  it("raises an undecided outcome without a hash when the request times out", async () => {
    const { service } = setup({ timeoutMs: 20 });
    nock(BASE_URL)
      .post("/v1/tx/derived")
      .delay(200)
      .reply(200, { data: { code: 0, hash: "ABC123", rawLog: "" } });

    const error = await service.signAndBroadcastWithDerivedWallet(1, messages()).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(TxOutcomeUnknownError);
    expect((error as TxOutcomeUnknownError).txHash).toBeUndefined();
  });

  it("raises an undecided outcome when an intermediary times out on the signer", async () => {
    const { service } = setup();
    nock(BASE_URL).post("/v1/tx/derived").reply(504, "upstream request timeout");

    await expect(service.signAndBroadcastWithDerivedWallet(1, messages())).rejects.toBeInstanceOf(TxOutcomeUnknownError);
  });

  it("leaves the signer's own unreachable-chain-node failure decided, so funding claims are not held over an RPC blip", async () => {
    const { service } = setup();
    nock(BASE_URL).post("/v1/tx/derived").reply(503, { error: "Error", message: "Bad status on response: 503", code: "service_unavailable" });

    const error = await service.signAndBroadcastWithDerivedWallet(1, messages()).catch((error: unknown) => error);

    expect(error).not.toBeInstanceOf(TxOutcomeUnknownError);
    expect((error as Error).message).toBe("Bad status on response: 503");
  });

  it("leaves a refused connection as a plain failure, since nothing reached the signer", async () => {
    const { service } = setup({ baseUrl: CLOSED_PORT_URL });

    const error = await service.signAndBroadcastWithDerivedWallet(1, messages()).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(TxOutcomeUnknownError);
    expect((error as Error).message).toContain("ECONNREFUSED");
  });

  it("leaves a chain rejection as a plain failure", async () => {
    const { service } = setup();
    nock(BASE_URL).post("/v1/tx/derived").reply(400, { message: "Deployment closed" });

    const error = await service.signAndBroadcastWithDerivedWallet(1, messages()).catch((error: unknown) => error);

    expect(error).not.toBeInstanceOf(TxOutcomeUnknownError);
    expect((error as Error).message).toBe("Deployment closed");
  });

  function messages() {
    return [{ typeUrl: "/akash.escrow.v1.MsgAccountDeposit", value: MsgAccountDeposit.fromPartial({}) }];
  }

  function setup(input?: { timeoutMs?: number; baseUrl?: string }) {
    const billingConfigService = mock<BillingConfigService>({
      get: vi.fn().mockImplementation(key => {
        const values = {
          TX_SIGNER_BASE_URL: input?.baseUrl ?? BASE_URL,
          TX_SIGNER_API_KEY: "a".repeat(32),
          TX_SIGNER_REQUEST_TIMEOUT_MS: input?.timeoutMs ?? 180_000
        };
        return values[key as keyof typeof values];
      })
    });
    const createLogger = (() => mock<ReturnType<CreateLogger>>()) as unknown as CreateLogger;
    const registry = mock<Registry>({ encode: vi.fn().mockReturnValue(new Uint8Array([1])) });
    const service = new ExternalSignerHttpSdkService(billingConfigService, createLogger, registry);

    return { service, billingConfigService };
  }
});
