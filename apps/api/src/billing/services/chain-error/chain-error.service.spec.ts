import type { BalanceHttpService } from "@akashnetwork/http-sdk";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { BadRequest, ServiceUnavailable } from "http-errors";
import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";

import type { Wallet } from "@src/billing/lib/wallet/wallet";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ChainErrorService } from "./chain-error.service";

const USDC_IBC_DENOMS = {
  mainnetId: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1",
  sandboxId: "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84"
};

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
      balanceHttpService.getBalance.mockResolvedValue({ amount: 5, denom: "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84" });

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(ServiceUnavailable);
      expect(appErr.message).toBe("Service temporarily unavailable");
    });

    it("returns 503 when master wallet balance is less than required in sandbox USDC", async () => {
      const { service, balanceHttpService } = setup();
      const denom = USDC_IBC_DENOMS.sandboxId;
      const err = new Error(`insufficient funds: 10${denom} is smaller than 20${denom}`);
      balanceHttpService.getBalance.mockResolvedValue({ amount: 5, denom: "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1" });

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
      balanceHttpService.getBalance.mockResolvedValue({ amount: 20, denom: "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84" });

      const appErr = await service.toAppError(err, encodeMessages);
      expect(appErr).toBeInstanceOf(BadRequest);
      expect(appErr.message).toBe("Insufficient funds");
    });

    it("returns 400 when master wallet balance is more than required in sandbox USDC", async () => {
      const { service, balanceHttpService } = setup();
      const denom = USDC_IBC_DENOMS.sandboxId;
      const err = new Error(`insufficient funds: 10${denom} is smaller than 20${denom}`);
      balanceHttpService.getBalance.mockResolvedValue({ amount: 20, denom: "ibc/12C6A0C374171B595A0A9E18B83FA09D295FB1F2D8C6DAA3AC28683471752D84" });

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
  });

  function setup(): {
    balanceHttpService: MockProxy<BalanceHttpService>;
    billingConfigService: MockProxy<BillingConfigService>;
    masterWallet: MockProxy<Wallet>;
    service: ChainErrorService;
  } {
    const balanceHttpService = mock<BalanceHttpService>();
    const billingConfigService = mock<BillingConfigService>();
    const masterWallet = mock<Wallet>();

    (billingConfigService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "USDC_IBC_DENOMS") return USDC_IBC_DENOMS;
      if (key === "DEPLOYMENT_GRANT_DENOM") return "uakt";
      return undefined;
    });

    masterWallet.getFirstAddress.mockResolvedValue("test-address");

    const service = new ChainErrorService(balanceHttpService, billingConfigService, masterWallet);

    return { balanceHttpService, billingConfigService, masterWallet, service };
  }
});
