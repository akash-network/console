import type { BalanceHttpService } from "@akashnetwork/http-sdk";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { AxiosError, AxiosHeaders } from "axios";
import { BadGateway, BadRequest, PaymentRequired, ServiceUnavailable } from "http-errors";
import type { Mock } from "vitest";
import type { MockProxy } from "vitest-mock-extended";
import { mock } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { TxManagerService } from "../tx-manager/tx-manager.service";
import { ChainErrorService } from "./chain-error.service";

const USDC_IBC_DENOMS = {
  mainnetId: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1",
  sandboxId: "ibc/028CD1864059EEFB48A6048376165318E3E82C234390AE5A6D7B22001725B06E"
} as const;

describe(ChainErrorService.name, () => {
  describe("toAppError", () => {
    const encodeMessages: EncodeObject[] = [];

    it("returns the original Error when no clue is found", async () => {
      const { service } = setup();
      const err = new Error("just some random failure");
      const result = await service.toAppError(err, encodeMessages);
      expect(result).toBe(err);
    });

    it("returns 503 when master wallet balance is less than required in uakt", async () => {
      const { service, balanceHttpService } = setup();
      const denom = "uakt";
      const err = new Error(`insufficient funds: 10${denom} is smaller than 20${denom}`);
      balanceHttpService.getBalance.mockResolvedValue({ amount: 5, denom: "uakt" });

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(ServiceUnavailable);
      expect(appErr.message).toBe("Service temporarily unavailable");
    });

    it("returns 503 when master wallet balance is less than required in mainnet USDC", async () => {
      const { service, balanceHttpService } = setup();
      const denom = USDC_IBC_DENOMS.mainnetId;
      const err = new Error(`insufficient funds: 10${denom} is smaller than 20${denom}`);
      balanceHttpService.getBalance.mockResolvedValue({ amount: 5, denom });

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(ServiceUnavailable);
      expect(appErr.message).toBe("Service temporarily unavailable");
    });

    it("returns 503 when master wallet balance is less than required in sandbox USDC", async () => {
      const { service, balanceHttpService } = setup();
      const denom = USDC_IBC_DENOMS.sandboxId;
      const err = new Error(`insufficient funds: 10${denom} is smaller than 20${denom}`);
      balanceHttpService.getBalance.mockResolvedValue({ amount: 5, denom });

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(ServiceUnavailable);
      expect(appErr.message).toBe("Service temporarily unavailable");
    });

    it("returns 400 when master wallet balance is more than required in uakt", async () => {
      const { service, balanceHttpService } = setup();
      const denom = "uakt";
      const err = new Error(`insufficient funds: 10${denom} is smaller than 20${denom}`);
      balanceHttpService.getBalance.mockResolvedValue({ amount: 20, denom: "uakt" });

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(BadRequest);
      expect(appErr.message).toBe("Insufficient funds");
    });

    it("returns 400 when master wallet balance is more than required in mainnet USDC", async () => {
      const { service, balanceHttpService } = setup();
      const denom = USDC_IBC_DENOMS.mainnetId;
      const err = new Error(`insufficient funds: 10${denom} is smaller than 20${denom}`);
      balanceHttpService.getBalance.mockResolvedValue({ amount: 20, denom });

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(BadRequest);
      expect(appErr.message).toBe("Insufficient funds");
    });

    it("returns 400 when master wallet balance is more than required in sandbox USDC", async () => {
      const { service, balanceHttpService } = setup();
      const denom = USDC_IBC_DENOMS.sandboxId;
      const err = new Error(`insufficient funds: 10${denom} is smaller than 20${denom}`);
      balanceHttpService.getBalance.mockResolvedValue({ amount: 20, denom });

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(BadRequest);
      expect(appErr.message).toBe("Insufficient funds");
    });

    it("returns 400 for an unsupported IBС denom", async () => {
      const { service, balanceHttpService } = setup();
      const denom = "ibc/UNKNOWN";
      const err = new Error(`insufficient funds: 10${denom} is smaller than 20${denom}`);
      balanceHttpService.getBalance.mockResolvedValue({ amount: 0, denom: "uakt" });

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(BadRequest);
      expect(appErr.message).toBe("Insufficient funds");
    });

    it("returns 400 for Invalid Owner Address error", async () => {
      const { service } = setup();
      const err = new Error("Invalid Owner Address: invalid address");

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(BadRequest);
      expect(appErr.message).toBe("Invalid owner address");
    });

    it("returns 400 for Invalid Owner Address error with message prefix", async () => {
      const { service } = setup();
      const err = new Error("Invalid Owner Address: invalid address message index: 0");
      const messages: EncodeObject[] = [{ typeUrl: "/akash.cert.v1.MsgCreateCertificate", value: {} }];

      const appErr = await service.toAppError(err, messages);
      expect(appErr).toBeInstanceOf(BadRequest);
      expect(appErr.message).toBe("Failed to create certificate: Invalid owner address");
    });

    it("returns 400 for Invalid deployment hash error", async () => {
      const { service } = setup();
      const err = new Error("Query failed with (6): rpc error: code = Unknown desc = failed to execute message; message index: 0: Invalid: deployment hash");

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(BadRequest);
      expect(appErr.message).toBe("Invalid deployment hash");
    });

    it("returns 400 for Invalid deployment hash error with message prefix", async () => {
      const { service } = setup();
      const err = new Error("Query failed with (6): rpc error: code = Unknown desc = failed to execute message; message index: 0: Invalid: deployment hash");
      const messages: EncodeObject[] = [{ typeUrl: "/akash.deployment.v1beta4.MsgCreateDeployment", value: {} }];

      const appErr = await service.toAppError(err, messages);
      expect(appErr).toBeInstanceOf(BadRequest);
      expect(appErr.message).toBe("Failed to create deployment: Invalid deployment hash");
    });

    it("returns 402 for insufficient balance error", async () => {
      const { service } = setup();
      const err = new Error(
        "Query failed with (6): rpc error: code = Unknown desc = failed to execute message; message index: 1: Deposit invalid: insufficient balance"
      );

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(PaymentRequired);
      expect(appErr.message).toBe("Insufficient balance");
    });

    it("returns 402 for insufficient balance error with message prefix", async () => {
      const { service } = setup();
      const err = new Error(
        "Query failed with (6): rpc error: code = Unknown desc = failed to execute message; message index: 0: Deposit invalid: insufficient balance"
      );
      const messages: EncodeObject[] = [{ typeUrl: "/akash.deployment.v1beta4.MsgCreateDeployment", value: {} }];

      const appErr = await service.toAppError(err, messages);
      expect(appErr).toBeInstanceOf(PaymentRequired);
      expect(appErr.message).toBe("Failed to create deployment: Insufficient balance");
    });

    it("returns 402 for simple insufficient balance message", async () => {
      const { service } = setup();
      const err = new Error("insufficient balance");

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(PaymentRequired);
      expect(appErr.message).toBe("Insufficient balance");
    });

    it("returns 502 when cause is an AxiosError with 502 status", async () => {
      const { service } = setup();
      const axiosError = new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
        status: 502,
        data: {},
        statusText: "Bad Gateway",
        headers: {},
        config: { headers: new AxiosHeaders() }
      });
      const err = new Error("Bad status on response: 502", { cause: axiosError });

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(BadGateway);
    });

    it("returns upstream 5xx status from cause", async () => {
      const { service } = setup();
      const axiosError = new AxiosError("Request failed", "ERR_BAD_RESPONSE", undefined, undefined, {
        status: 503,
        data: {},
        statusText: "Service Unavailable",
        headers: {},
        config: { headers: new AxiosHeaders() }
      });
      const err = new Error("Service unavailable", { cause: axiosError });

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(ServiceUnavailable);
    });

    it("returns original error when cause is an AxiosError with 4xx status", async () => {
      const { service } = setup();
      const axiosError = new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 400,
        data: {},
        statusText: "Bad Request",
        headers: {},
        config: { headers: new AxiosHeaders() }
      });
      const err = new Error("Some upstream error", { cause: axiosError });

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBe(err);
    });

    it("returns original error when cause is not an AxiosError", async () => {
      const { service } = setup();
      const err = new Error("Unknown failure", { cause: new Error("some cause") });

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBe(err);
    });
  });

  function setup(): {
    balanceHttpService: MockProxy<BalanceHttpService>;
    billingConfigService: MockProxy<BillingConfigService>;
    txManagerService: MockProxy<TxManagerService>;
    service: ChainErrorService;
  } {
    const balanceHttpService = mock<BalanceHttpService>();
    const billingConfigService = mock<BillingConfigService>();
    const txManagerService = mock<TxManagerService>();

    (billingConfigService.get as Mock).mockImplementation((key: string) => {
      if (key === "USDC_IBC_DENOMS") return USDC_IBC_DENOMS;
      if (key === "DEPLOYMENT_GRANT_DENOM") return "uakt";
      return undefined;
    });

    txManagerService.getFundingWalletAddress.mockResolvedValue("test-address");

    const service = new ChainErrorService(balanceHttpService, billingConfigService, txManagerService);

    return { balanceHttpService, billingConfigService, txManagerService, service };
  }
});
