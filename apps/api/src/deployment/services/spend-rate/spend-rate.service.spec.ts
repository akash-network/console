import { createMongoAbility } from "@casl/ability";
import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { organizationRules } from "@src/auth/services/ability/ability-rules";
import type { AuthService } from "@src/auth/services/auth.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { LeaseRepository, LivePricePerDeployment } from "@src/deployment/repositories/lease/lease.repository";
import type { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import { SpendRateService } from "./spend-rate.service";

import { createOrganizationContext, createProjectsScope } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createInitializedUserWallet } from "@test/seeders/user-wallet.seeder";

describe(SpendRateService.name, () => {
  describe("findByUserId", () => {
    it("answers each deployment's summed live price in the shape a lease reports its price", async () => {
      const { service, wallet } = setup({
        livePrices: [
          { dseq: "100", denom: "uact", price: 1.5 },
          { dseq: "200", denom: "uact", price: 0.25 }
        ]
      });

      const spendRate = await service.findByUserId(wallet.userId);

      expect(spendRate).toEqual([
        { dseq: "100", price: { denom: "uact", amount: "1.500000000000000000" } },
        { dseq: "200", price: { denom: "uact", amount: "0.250000000000000000" } }
      ]);
    });

    it("keeps a deployment priced in two denoms as one entry per denom", async () => {
      const { service, wallet } = setup({
        livePrices: [
          { dseq: "100", denom: "uact", price: 3 },
          { dseq: "100", denom: "uakt", price: 7 }
        ]
      });

      const spendRate = await service.findByUserId(wallet.userId);

      expect(spendRate).toEqual([
        { dseq: "100", price: { denom: "uact", amount: "3.000000000000000000" } },
        { dseq: "100", price: { denom: "uakt", amount: "7.000000000000000000" } }
      ]);
    });

    it("reads the live leases of the user's own wallet", async () => {
      const { service, wallet, walletReaderService, leaseRepository } = setup();

      await service.findByUserId(wallet.userId);

      expect(walletReaderService.getReadableWalletByUserId).toHaveBeenCalledExactlyOnceWith(wallet.userId);
      expect(leaseRepository.sumLivePricesPerDeployment).toHaveBeenCalledExactlyOnceWith(wallet.address);
    });

    it("answers no deployment when nothing is running", async () => {
      const { service, wallet } = setup({ livePrices: [] });

      const spendRate = await service.findByUserId(wallet.userId);

      expect(spendRate).toEqual([]);
    });

    it("leaves out deployments outside the projects of a member", async () => {
      const { service, wallet, signerService } = setup({
        context: createOrganizationContext({ role: "member", projectScope: createProjectsScope(["granted"]) }),
        livePrices: [
          { dseq: "1", denom: "uact", price: 1 },
          { dseq: "2", denom: "uact", price: 2 }
        ],
        visibleDseqs: ["2"]
      });

      const rates = await service.findByUserId(wallet.userId);

      expect(signerService.filterDeploymentsInProjectScope).toHaveBeenCalledWith(wallet, ["1", "2"], "read");
      expect(rates.map(({ dseq }) => dseq)).toEqual(["2"]);
    });

    it("answers every deployment to a billing member, who reaches no project", async () => {
      const { service, wallet, signerService } = setup({
        context: createOrganizationContext({ role: "billing", projectScope: createProjectsScope([]) }),
        livePrices: [
          { dseq: "1", denom: "uact", price: 1 },
          { dseq: "2", denom: "uact", price: 2 }
        ],
        visibleDseqs: []
      });

      const rates = await service.findByUserId(wallet.userId);

      expect(rates.map(({ dseq }) => dseq)).toEqual(["1", "2"]);
      expect(signerService.filterDeploymentsInProjectScope).not.toHaveBeenCalled();
    });

    it("refuses a user without a wallet before reading any lease", async () => {
      const { service, wallet, walletReaderService, leaseRepository } = setup();
      walletReaderService.getReadableWalletByUserId.mockRejectedValue(createError(404, "UserWallet Not Found"));

      await expect(service.findByUserId(wallet.userId)).rejects.toMatchObject({ status: 404 });
      expect(leaseRepository.sumLivePricesPerDeployment).not.toHaveBeenCalled();
    });
  });

  describe("findWeeklyCostByUserId", () => {
    it("answers the weekly cost of every auto top-up deployment of the user's wallet to an owner", async () => {
      const { service, wallet, walletReaderService, drainingDeploymentService, signerService } = setup({ autoTopUpDseqs: ["1", "2"] });

      const weeklyCost = await service.findWeeklyCostByUserId(wallet.userId);

      expect(weeklyCost).toBe(20);
      expect(walletReaderService.findReadableWalletByUserId).toHaveBeenCalledExactlyOnceWith(wallet.userId);
      expect(drainingDeploymentService.calculateWeeklyCoverageForAddress).toHaveBeenCalledWith(wallet.address, expect.any(Function));
      expect(signerService.filterDeploymentsInProjectScope).not.toHaveBeenCalled();
    });

    it("answers the weekly cost of the deployments in a member's projects only", async () => {
      const { service, wallet, signerService } = setup({
        context: createOrganizationContext({ role: "member", projectScope: createProjectsScope(["granted"]) }),
        autoTopUpDseqs: ["1", "2", "3"],
        visibleDseqs: ["3"]
      });

      const weeklyCost = await service.findWeeklyCostByUserId(wallet.userId);

      expect(weeklyCost).toBe(10);
      expect(signerService.filterDeploymentsInProjectScope).toHaveBeenCalledWith(wallet, ["1", "2", "3"], "read");
    });

    it("answers the weekly cost of the whole organization to a billing member", async () => {
      const { service, wallet } = setup({
        context: createOrganizationContext({ role: "billing", projectScope: createProjectsScope([]) }),
        autoTopUpDseqs: ["1", "2", "3"],
        visibleDseqs: []
      });

      const weeklyCost = await service.findWeeklyCostByUserId(wallet.userId);

      expect(weeklyCost).toBe(30);
    });

    it("answers the weekly cost of its project only to an owner's key bound to that project", async () => {
      const { service, wallet } = setup({
        context: createOrganizationContext({ role: "owner", projectScope: createProjectsScope(["bound"]) }),
        autoTopUpDseqs: ["1", "2"],
        visibleDseqs: ["1"]
      });

      const weeklyCost = await service.findWeeklyCostByUserId(wallet.userId);

      expect(weeklyCost).toBe(10);
    });

    it("leaves the organization spend right unconsulted while organizations are off", async () => {
      const { service, wallet, signerService } = setup({
        context: createOrganizationContext({ role: "owner", mode: "legacy" }),
        autoTopUpDseqs: ["1", "2"]
      });

      const weeklyCost = await service.findWeeklyCostByUserId(wallet.userId);

      expect(weeklyCost).toBe(20);
      expect(signerService.filterDeploymentsInProjectScope).toHaveBeenCalledWith(wallet, ["1", "2"], "read");
    });

    it("leaves the organization spend right unconsulted for a request without an organization context", async () => {
      const { service, wallet, signerService } = setup({ withoutContext: true, autoTopUpDseqs: ["1", "2"] });

      const weeklyCost = await service.findWeeklyCostByUserId(wallet.userId);

      expect(weeklyCost).toBe(20);
      expect(signerService.filterDeploymentsInProjectScope).toHaveBeenCalledWith(wallet, ["1", "2"], "read");
    });

    it("answers 0 for a user without a wallet", async () => {
      const { service, wallet, walletReaderService, drainingDeploymentService } = setup();
      walletReaderService.findReadableWalletByUserId.mockResolvedValue(undefined);

      const weeklyCost = await service.findWeeklyCostByUserId(wallet.userId);

      expect(weeklyCost).toBe(0);
      expect(drainingDeploymentService.calculateWeeklyCoverageForAddress).not.toHaveBeenCalled();
    });

    it("answers 0 for a wallet not yet given an address", async () => {
      const { service, wallet, walletReaderService, drainingDeploymentService } = setup();
      walletReaderService.findReadableWalletByUserId.mockResolvedValue({ ...wallet, address: null });

      const weeklyCost = await service.findWeeklyCostByUserId(wallet.userId);

      expect(weeklyCost).toBe(0);
      expect(drainingDeploymentService.calculateWeeklyCoverageForAddress).not.toHaveBeenCalled();
    });
  });

  function setup(
    input: {
      context?: OrganizationContext;
      withoutContext?: boolean;
      livePrices?: LivePricePerDeployment[];
      visibleDseqs?: string[];
      autoTopUpDseqs?: string[];
    } = {}
  ) {
    const context = input.context ?? createOrganizationContext({ organizationType: "personal" });
    const wallet = createInitializedUserWallet({ organizationId: context.organizationId });
    const walletReaderService = mock<WalletReaderService>();
    walletReaderService.getReadableWalletByUserId.mockResolvedValue(wallet);
    walletReaderService.findReadableWalletByUserId.mockResolvedValue(wallet);
    const leaseRepository = mock<LeaseRepository>();
    leaseRepository.sumLivePricesPerDeployment.mockResolvedValue(input.livePrices ?? []);
    const signerService = mock<ManagedSignerService>();
    signerService.filterDeploymentsInProjectScope.mockImplementation(async (_wallet, dseqs) => input.visibleDseqs ?? [...dseqs]);
    const drainingDeploymentService = mock<DrainingDeploymentService>();
    drainingDeploymentService.calculateWeeklyCoverageForAddress.mockImplementation(async (_address, keepDseqs) => {
      const kept = (await keepDseqs?.(input.autoTopUpDseqs ?? [])) ?? [];
      return { weeklyCostUsd: kept.length * 10, cumulativeDailyCostsUsd: [], hasAutoTopUpSettings: kept.length > 0 };
    });
    const authService = mock<AuthService>();
    authService.ability = createMongoAbility(organizationRules(createUser(), context));
    const executionContextService = mock<ExecutionContextService>({
      get: vi.fn((key: string) => (key === "ORGANIZATION_CONTEXT" && !input.withoutContext ? context : undefined)) as ExecutionContextService["get"]
    });

    const service = new SpendRateService(walletReaderService, leaseRepository, signerService, drainingDeploymentService, authService, executionContextService);

    return { service, wallet, walletReaderService, leaseRepository, signerService, drainingDeploymentService };
  }
});
