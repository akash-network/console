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
const API_KEY = "a".repeat(32);
const WALLET = { derivationIndex: 1, seedVersion: "v2" };

describe(ExternalSignerHttpSdkService.name, () => {
  it("returns the landed transaction the signer reports", async () => {
    const { service } = setup();
    nock(BASE_URL)
      .post("/v1/tx/derived")
      .reply(200, { data: { code: 0, hash: "ABC123", rawLog: "" } });

    const result = await service.signAndBroadcastWithDerivedWallet(WALLET, messages());

    expect(result).toEqual({ code: 0, hash: "ABC123", rawLog: "" });
  });

  it("names the derivation index and the seed version of the wallet a derived transaction is signed with", async () => {
    const { service } = setup();
    let requestBody: unknown;
    nock(BASE_URL)
      .post("/v1/tx/derived", body => {
        requestBody = body;
        return true;
      })
      .reply(200, { data: { code: 0, hash: "ABC123", rawLog: "" } });

    await service.signAndBroadcastWithDerivedWallet({ derivationIndex: 12, seedVersion: "v3" }, messages(), { fee: { granter: "akash1granter" } });

    expect(requestBody).toEqual({
      data: {
        derivationIndex: 12,
        seedVersion: "v3",
        messages: [{ typeUrl: messages()[0].typeUrl, value: "AQ==" }],
        options: { fee: { granter: "akash1granter" } }
      }
    });
  });

  it("names the grantee's derivation index and seed version on a funding transaction", async () => {
    const { service } = setup();
    let requestBody: unknown;
    nock(BASE_URL)
      .post("/v1/tx/funding", body => {
        requestBody = body;
        return true;
      })
      .reply(200, { data: { code: 0, hash: "ABC123", rawLog: "" } });

    const result = await service.signAndBroadcastWithFundingWallet(messages(), { derivationIndex: 7, seedVersion: "v3" });

    expect(result).toEqual({ code: 0, hash: "ABC123", rawLog: "" });
    expect(requestBody).toEqual({
      data: { messages: [{ typeUrl: messages()[0].typeUrl, value: "AQ==" }], granteeDerivationIndex: 7, granteeSeedVersion: "v3" }
    });
  });

  it("sends a funding transaction without a grantee when none is named", async () => {
    const { service } = setup();
    let requestBody: unknown;
    nock(BASE_URL)
      .post("/v1/tx/funding", body => {
        requestBody = body;
        return true;
      })
      .reply(200, { data: { code: 0, hash: "ABC123", rawLog: "" } });

    await service.signAndBroadcastWithFundingWallet(messages());

    expect(requestBody).toEqual({ data: { messages: [{ typeUrl: messages()[0].typeUrl, value: "AQ==" }] } });
  });

  it("raises a not-included outcome with its hash when the signer proves the transaction expired", async () => {
    const { service } = setup();
    nock(BASE_URL)
      .post("/v1/tx/derived")
      .reply(502, { message: "expired", data: { outcome: "not_included", txHash: "ABC123" } });

    const error = await service.signAndBroadcastWithDerivedWallet(WALLET, messages()).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(TxNotIncludedError);
    expect((error as TxNotIncludedError).txHash).toBe("ABC123");
  });

  it("raises an undecided outcome with its hash when the signer could not decide", async () => {
    const { service } = setup();
    nock(BASE_URL)
      .post("/v1/tx/derived")
      .reply(504, { message: "undecided", data: { outcome: "unknown", txHash: "ABC123" } });

    const error = await service.signAndBroadcastWithDerivedWallet(WALLET, messages()).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(TxOutcomeUnknownError);
    expect((error as TxOutcomeUnknownError).txHash).toBe("ABC123");
  });

  it("raises an undecided outcome without a hash when the request times out", async () => {
    const { service } = setup({ timeoutMs: 20 });
    nock(BASE_URL)
      .post("/v1/tx/derived")
      .delay(200)
      .reply(200, { data: { code: 0, hash: "ABC123", rawLog: "" } });

    const error = await service.signAndBroadcastWithDerivedWallet(WALLET, messages()).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(TxOutcomeUnknownError);
    expect((error as TxOutcomeUnknownError).txHash).toBeUndefined();
  });

  it("raises an undecided outcome when an intermediary times out on the signer", async () => {
    const { service } = setup();
    nock(BASE_URL).post("/v1/tx/derived").reply(504, "upstream request timeout");

    await expect(service.signAndBroadcastWithDerivedWallet(WALLET, messages())).rejects.toBeInstanceOf(TxOutcomeUnknownError);
  });

  it("leaves the signer's own unreachable-chain-node failure decided, so funding claims are not held over an RPC blip", async () => {
    const { service } = setup();
    nock(BASE_URL).post("/v1/tx/derived").reply(503, { error: "Error", message: "Bad status on response: 503", code: "service_unavailable" });

    const error = await service.signAndBroadcastWithDerivedWallet(WALLET, messages()).catch((error: unknown) => error);

    expect(error).not.toBeInstanceOf(TxOutcomeUnknownError);
    expect((error as Error).message).toBe("Bad status on response: 503");
  });

  it("leaves a refused connection as a plain failure, since nothing reached the signer", async () => {
    const { service } = setup({ baseUrl: CLOSED_PORT_URL });

    const error = await service.signAndBroadcastWithDerivedWallet(WALLET, messages()).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(TxOutcomeUnknownError);
    expect((error as Error).message).toContain("ECONNREFUSED");
  });

  it("leaves a chain rejection as a plain failure", async () => {
    const { service } = setup();
    nock(BASE_URL).post("/v1/tx/derived").reply(400, { message: "Deployment closed" });

    const error = await service.signAndBroadcastWithDerivedWallet(WALLET, messages()).catch((error: unknown) => error);

    expect(error).not.toBeInstanceOf(TxOutcomeUnknownError);
    expect((error as Error).message).toBe("Deployment closed");
  });

  describe("getFundingWalletAddresses", () => {
    it("returns the funding wallet addresses in the order the signer lists them, authenticating with the api key", async () => {
      const { service } = setup();
      nock(BASE_URL, { reqheaders: { "x-api-key": API_KEY } })
        .get("/v1/wallets/funding")
        .reply(200, { data: { addresses: ["akash1seedphrase", "akash1keyservice"] } });

      await expect(service.getFundingWalletAddresses()).resolves.toEqual(["akash1seedphrase", "akash1keyservice"]);
    });

    it("fails with the path and the reason the signer gives, and logs them", async () => {
      const { service, logger } = setup();
      nock(BASE_URL).get("/v1/wallets/funding").reply(401, { message: "Invalid or missing API key" });

      await expect(service.getFundingWalletAddresses()).rejects.toThrow("The signer did not answer /v1/wallets/funding: Invalid or missing API key");

      expect(logger.error).toHaveBeenCalledWith({
        event: "TX_SIGNER_WALLET_REQUEST_FAILED",
        path: "/v1/wallets/funding",
        status: 401,
        message: "Invalid or missing API key"
      });
    });

    it("fails with the transport error when nothing answers", async () => {
      const { service, logger } = setup({ baseUrl: CLOSED_PORT_URL });

      await expect(service.getFundingWalletAddresses()).rejects.toThrow(/^The signer did not answer \/v1\/wallets\/funding: .*ECONNREFUSED/);

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "TX_SIGNER_WALLET_REQUEST_FAILED", status: undefined }));
    });

    it("gives up after the wallet request timeout rather than the signing one", async () => {
      const { service } = setup({ walletTimeoutMs: 20 });
      nock(BASE_URL)
        .get("/v1/wallets/funding")
        .delay(300)
        .reply(200, { data: { addresses: [] } });

      await expect(service.getFundingWalletAddresses()).rejects.toThrow("timeout of 20ms exceeded");
    });
  });

  describe("getDerivedWalletAddress", () => {
    it.each(["v1", "v2", "v3"])("returns the %s address of the user wallet at an index", async seedVersion => {
      const { service } = setup();
      nock(BASE_URL, { reqheaders: { "x-api-key": API_KEY } })
        .get("/v1/wallets/derived/12")
        .query({ version: seedVersion })
        .reply(200, { data: { address: `akash1${seedVersion}` } });

      await expect(service.getDerivedWalletAddress({ derivationIndex: 12, seedVersion })).resolves.toBe(`akash1${seedVersion}`);
    });

    it("fails when the signer cannot serve the address", async () => {
      const { service } = setup();
      nock(BASE_URL).get("/v1/wallets/derived/12").query({ version: "v1" }).reply(501, { message: "This signer holds no derivation seed v1" });

      await expect(service.getDerivedWalletAddress({ derivationIndex: 12, seedVersion: "v1" })).rejects.toThrow(
        "The signer did not answer /v1/wallets/derived/12: This signer holds no derivation seed v1"
      );
    });
  });

  describe("issueProviderToken", () => {
    it("returns the token the signer issues for the wallet, access and lifetime asked for", async () => {
      const { service } = setup();
      const request = { derivationIndex: 7, seedVersion: "v3", leases: { access: "full" as const }, ttl: 45 };
      let requestBody: unknown;
      nock(BASE_URL, { reqheaders: { "x-api-key": API_KEY } })
        .post("/v1/wallets/provider-tokens", body => {
          requestBody = body;
          return true;
        })
        .reply(200, { data: { token: "signed-token" } });

      const result = await service.issueProviderToken(request);

      expect(result.unwrap()).toBe("signed-token");
      expect(requestBody).toEqual({ data: request });
    });

    it("returns the reason when the signer refuses the token as malformed", async () => {
      const { service, logger } = setup();
      nock(BASE_URL).post("/v1/wallets/provider-tokens").reply(400, { message: "The provider token asked for is not valid: no permissions" });

      const result = await service.issueProviderToken({ derivationIndex: 7, seedVersion: "v2", leases: { access: "full" }, ttl: 45 });

      expect(result.err).toBe(true);
      expect(result.val).toEqual(["The provider token asked for is not valid: no permissions"]);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("returns a reason of its own when the signer refuses the token without giving one", async () => {
      const { service } = setup();
      nock(BASE_URL).post("/v1/wallets/provider-tokens").reply(400, "");

      const result = await service.issueProviderToken({ derivationIndex: 7, seedVersion: "v2", leases: { access: "full" }, ttl: 45 });

      expect(result.val).toEqual(["The signer refused the provider token asked for"]);
    });

    it.each([401, 500, 503])("fails when the signer answers %s", async status => {
      const { service } = setup();
      nock(BASE_URL).post("/v1/wallets/provider-tokens").reply(status, { message: "signer trouble" });

      await expect(service.issueProviderToken({ derivationIndex: 7, seedVersion: "v2", leases: { access: "full" }, ttl: 45 })).rejects.toThrow(
        "The signer did not answer /v1/wallets/provider-tokens: signer trouble"
      );
    });
  });

  function messages() {
    return [{ typeUrl: "/akash.escrow.v1.MsgAccountDeposit", value: MsgAccountDeposit.fromPartial({}) }];
  }

  function setup(input?: { timeoutMs?: number; walletTimeoutMs?: number; baseUrl?: string }) {
    const billingConfigService = mock<BillingConfigService>({
      get: vi.fn().mockImplementation(key => {
        const values = {
          TX_SIGNER_BASE_URL: input?.baseUrl ?? BASE_URL,
          TX_SIGNER_API_KEY: API_KEY,
          TX_SIGNER_REQUEST_TIMEOUT_MS: input?.timeoutMs ?? 180_000,
          TX_SIGNER_WALLET_REQUEST_TIMEOUT_MS: input?.walletTimeoutMs ?? 10_000
        };
        return values[key as keyof typeof values];
      })
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = (() => logger) as unknown as CreateLogger;
    const registry = mock<Registry>({ encode: vi.fn().mockReturnValue(new Uint8Array([1])) });
    const service = new ExternalSignerHttpSdkService(billingConfigService, createLogger, registry);

    return { service, billingConfigService, logger };
  }
});
