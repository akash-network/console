import type { CosmosHttpService } from "@akashnetwork/http-sdk";
import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GetAddressResponse } from "@src/address/http-schemas/address.schema";
import MemoryCacheEngine from "@src/caching/memoryCacheEngine";
import type { TransactionService } from "@src/transaction/services/transaction/transaction.service";
import type { ValidatorRepository } from "@src/validator/repositories/validator/validator.repository";
import { AddressService } from "./address.service";

describe(AddressService.name, () => {
  describe("getAddressDetails", () => {
    it("handles validator commission fetch error gracefully when validator doesn't exist on-chain", async () => {
      const { service, cosmosHttpService, validatorRepository } = setup();
      const testAddress = "akash1test123";
      const operatorAddress = "akashvaloper1test123";

      // Mock validator exists in DB
      validatorRepository.findByAccountAddress.mockResolvedValue({
        id: "1",
        operatorAddress,
        accountAddress: testAddress,
        moniker: "Test Validator",
        keybaseAvatarUrl: null,
        identity: null,
        createdHeight: 100,
        isActive: true
      } as any);

      validatorRepository.findAll.mockResolvedValue([]);

      // Mock successful responses for other endpoints
      cosmosHttpService.getBankBalancesByAddress.mockResolvedValue({
        balances: [{ denom: "uakt", amount: "1000000" }],
        pagination: { next_key: null, total: "1" }
      } as any);

      cosmosHttpService.getStakingDelegationsByAddress.mockResolvedValue({
        delegation_responses: [],
        pagination: { next_key: null, total: "0" }
      } as any);

      cosmosHttpService.getDistributionDelegatorsRewardsByAddress.mockResolvedValue({
        rewards: [],
        total: []
      } as any);

      cosmosHttpService.getStakingDelegatorsRedelegationsByAddress.mockResolvedValue({
        redelegation_responses: [],
        pagination: { next_key: null, total: "0" }
      } as any);

      // Mock validator commission fetch to throw 500 error (validator not found on-chain)
      const axiosError = new AxiosError("validator does not exist");
      axiosError.response = {
        status: 500,
        data: { message: "codespace staking code 3: validator does not exist" },
        statusText: "Internal Server Error",
        headers: {},
        config: {} as any
      };
      cosmosHttpService.getDistributionValidatorsCommissionByAddress.mockRejectedValue(axiosError);

      const result = await service.getAddressDetails(testAddress);

      expect(result.commission).toBe(0);
      expect(result.available).toBe(1000000);
      expect(cosmosHttpService.getDistributionValidatorsCommissionByAddress).toHaveBeenCalledWith(operatorAddress);
    });

    it("fetches validator commission successfully when validator exists on-chain", async () => {
      const { service, cosmosHttpService, validatorRepository } = setup();
      const testAddress = "akash1test123";
      const operatorAddress = "akashvaloper1test123";

      // Mock validator exists in DB
      validatorRepository.findByAccountAddress.mockResolvedValue({
        id: "1",
        operatorAddress,
        accountAddress: testAddress,
        moniker: "Test Validator",
        keybaseAvatarUrl: null,
        identity: null,
        createdHeight: 100,
        isActive: true
      } as any);

      validatorRepository.findAll.mockResolvedValue([]);

      // Mock successful responses for other endpoints
      cosmosHttpService.getBankBalancesByAddress.mockResolvedValue({
        balances: [{ denom: "uakt", amount: "1000000" }],
        pagination: { next_key: null, total: "1" }
      } as any);

      cosmosHttpService.getStakingDelegationsByAddress.mockResolvedValue({
        delegation_responses: [],
        pagination: { next_key: null, total: "0" }
      } as any);

      cosmosHttpService.getDistributionDelegatorsRewardsByAddress.mockResolvedValue({
        rewards: [],
        total: []
      } as any);

      cosmosHttpService.getStakingDelegatorsRedelegationsByAddress.mockResolvedValue({
        redelegation_responses: [],
        pagination: { next_key: null, total: "0" }
      } as any);

      // Mock successful validator commission fetch
      cosmosHttpService.getDistributionValidatorsCommissionByAddress.mockResolvedValue({
        commission: {
          commission: [{ denom: "uakt", amount: "100.5" }]
        }
      } as any);

      const result = await service.getAddressDetails(testAddress);

      expect(result.commission).toBe(100.5);
      expect(result.available).toBe(1000000);
      expect(cosmosHttpService.getDistributionValidatorsCommissionByAddress).toHaveBeenCalledWith(operatorAddress);
    });

    it("sets commission to 0 when validator is not found in DB", async () => {
      const { service, cosmosHttpService, validatorRepository } = setup();
      const testAddress = "akash1test123";

      // Mock validator doesn't exist in DB
      validatorRepository.findByAccountAddress.mockResolvedValue(null);
      validatorRepository.findAll.mockResolvedValue([]);

      // Mock successful responses for other endpoints
      cosmosHttpService.getBankBalancesByAddress.mockResolvedValue({
        balances: [{ denom: "uakt", amount: "1000000" }],
        pagination: { next_key: null, total: "1" }
      } as any);

      cosmosHttpService.getStakingDelegationsByAddress.mockResolvedValue({
        delegation_responses: [],
        pagination: { next_key: null, total: "0" }
      } as any);

      cosmosHttpService.getDistributionDelegatorsRewardsByAddress.mockResolvedValue({
        rewards: [],
        total: []
      } as any);

      cosmosHttpService.getStakingDelegatorsRedelegationsByAddress.mockResolvedValue({
        redelegation_responses: [],
        pagination: { next_key: null, total: "0" }
      } as any);

      const result = await service.getAddressDetails(testAddress);

      expect(result.commission).toBe(0);
      expect(result.available).toBe(1000000);
      expect(cosmosHttpService.getDistributionValidatorsCommissionByAddress).not.toHaveBeenCalled();
    });

    it("re-throws non-500 errors from validator commission fetch", async () => {
      const { service, cosmosHttpService, validatorRepository } = setup();
      const testAddress = "akash1test123";
      const operatorAddress = "akashvaloper1test123";

      // Mock validator exists in DB
      validatorRepository.findByAccountAddress.mockResolvedValue({
        id: "1",
        operatorAddress,
        accountAddress: testAddress,
        moniker: "Test Validator",
        keybaseAvatarUrl: null,
        identity: null,
        createdHeight: 100,
        isActive: true
      } as any);

      validatorRepository.findAll.mockResolvedValue([]);

      // Mock successful responses for other endpoints
      cosmosHttpService.getBankBalancesByAddress.mockResolvedValue({
        balances: [{ denom: "uakt", amount: "1000000" }],
        pagination: { next_key: null, total: "1" }
      } as any);

      cosmosHttpService.getStakingDelegationsByAddress.mockResolvedValue({
        delegation_responses: [],
        pagination: { next_key: null, total: "0" }
      } as any);

      cosmosHttpService.getDistributionDelegatorsRewardsByAddress.mockResolvedValue({
        rewards: [],
        total: []
      } as any);

      cosmosHttpService.getStakingDelegatorsRedelegationsByAddress.mockResolvedValue({
        redelegation_responses: [],
        pagination: { next_key: null, total: "0" }
      } as any);

      // Mock validator commission fetch to throw 400 error (different error)
      const axiosError = new AxiosError("Bad Request");
      axiosError.response = {
        status: 400,
        data: { message: "Invalid request" },
        statusText: "Bad Request",
        headers: {},
        config: {} as any
      };
      cosmosHttpService.getDistributionValidatorsCommissionByAddress.mockRejectedValue(axiosError);

      await expect(service.getAddressDetails(testAddress)).rejects.toThrow(axiosError);
    });

    it("lists the five latest transactions of the address without counting all of them", async () => {
      const { service, transactionService } = setup();
      const latestTransactions: GetAddressResponse["latestTransactions"] = [
        {
          height: 28875296,
          datetime: "2026-10-01T19:52:51.589Z",
          hash: "8DBCA7F3CA9BDED60CB275432F7AEB6360A1CE502F200ACBCF352610E566005F",
          isSuccess: true,
          error: null,
          gasUsed: 302198,
          gasWanted: 423489,
          fee: 10588,
          memo: "akash price update",
          isSigner: true,
          messages: [{ id: "d8298c23-97e9-43a0-8d2c-96b3d819b536", type: "/cosmwasm.wasm.v1.MsgExecuteContract", amount: 0, isReceiver: false }]
        }
      ];
      transactionService.getLatestTransactionsByAddress.mockResolvedValue(latestTransactions);

      const result = await service.getAddressDetails("akash1test123");

      expect(result.latestTransactions).toEqual(latestTransactions);
      expect(transactionService.getLatestTransactionsByAddress).toHaveBeenCalledWith("akash1test123", 5);
      expect(transactionService.getTransactionsByAddress).not.toHaveBeenCalled();
    });
  });

  function setup() {
    MemoryCacheEngine.clearAllCaches();

    const transactionService = mock<TransactionService>();
    transactionService.getLatestTransactionsByAddress.mockResolvedValue([]);
    const cosmosHttpService = mock<CosmosHttpService>();
    cosmosHttpService.getBankBalancesByAddress.mockResolvedValue(mock<Awaited<ReturnType<CosmosHttpService["getBankBalancesByAddress"]>>>({ balances: [] }));
    cosmosHttpService.getStakingDelegationsByAddress.mockResolvedValue(
      mock<Awaited<ReturnType<CosmosHttpService["getStakingDelegationsByAddress"]>>>({ delegation_responses: [] })
    );
    cosmosHttpService.getDistributionDelegatorsRewardsByAddress.mockResolvedValue(
      mock<Awaited<ReturnType<CosmosHttpService["getDistributionDelegatorsRewardsByAddress"]>>>({ rewards: [], total: [] })
    );
    cosmosHttpService.getStakingDelegatorsRedelegationsByAddress.mockResolvedValue(
      mock<Awaited<ReturnType<CosmosHttpService["getStakingDelegatorsRedelegationsByAddress"]>>>({ redelegation_responses: [] })
    );
    const validatorRepository = mock<ValidatorRepository>();
    validatorRepository.findAll.mockResolvedValue([]);
    validatorRepository.findByAccountAddress.mockResolvedValue(null);
    const service = new AddressService(transactionService, cosmosHttpService, validatorRepository);

    return { cosmosHttpService, transactionService, validatorRepository, service };
  }
});
