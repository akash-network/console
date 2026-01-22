import type { CosmosHttpService } from "@akashnetwork/http-sdk/src/cosmos/cosmos-http.service";
import { AxiosError } from "axios";
import type { MockProxy } from "jest-mock-extended";
import { mock } from "jest-mock-extended";

import { cacheEngine } from "@src/caching/helpers";
import type { TransactionService } from "@src/transaction/services/transaction/transaction.service";
import type { ValidatorRepository } from "@src/validator/repositories/validator/validator.repository";
import { AddressService } from "./address.service";

describe(AddressService.name, () => {
  describe("getAddressDetails", () => {
    it("handles validator commission fetch error gracefully when validator doesn't exist on-chain", async () => {
      const { service, cosmosHttpService, validatorRepository, transactionService } = setup();
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

      transactionService.getTransactionsByAddress.mockResolvedValue({
        results: [],
        count: 0
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
      const { service, cosmosHttpService, validatorRepository, transactionService } = setup();
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

      transactionService.getTransactionsByAddress.mockResolvedValue({
        results: [],
        count: 0
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
      const { service, cosmosHttpService, validatorRepository, transactionService } = setup();
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

      transactionService.getTransactionsByAddress.mockResolvedValue({
        results: [],
        count: 0
      } as any);

      const result = await service.getAddressDetails(testAddress);

      expect(result.commission).toBe(0);
      expect(result.available).toBe(1000000);
      expect(cosmosHttpService.getDistributionValidatorsCommissionByAddress).not.toHaveBeenCalled();
    });

    it("re-throws non-500 errors from validator commission fetch", async () => {
      const { service, cosmosHttpService, validatorRepository, transactionService } = setup();
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

      transactionService.getTransactionsByAddress.mockResolvedValue({
        results: [],
        count: 0
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
  });

  function setup(): {
    cosmosHttpService: MockProxy<CosmosHttpService>;
    transactionService: MockProxy<TransactionService>;
    validatorRepository: MockProxy<ValidatorRepository>;
    service: AddressService;
  } {
    cacheEngine.clearAllKeyInCache();

    const transactionService = mock<TransactionService>();
    const cosmosHttpService = mock<CosmosHttpService>();
    const validatorRepository = mock<ValidatorRepository>();
    const service = new AddressService(transactionService, cosmosHttpService, validatorRepository);

    return { cosmosHttpService, transactionService, validatorRepository, service };
  }
});
