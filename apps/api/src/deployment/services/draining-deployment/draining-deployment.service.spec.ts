import { faker } from "@faker-js/faker";

import { USDC_IBC_DENOMS } from "@src/billing/config/network.config";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { DeploymentConfig } from "@src/deployment/config/config.provider";
import { DrainingDeploymentOutput, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { DrainingDeploymentService } from "./draining-deployment.service";

import { AkashAddressSeeder } from "@test/seeders/akash-address.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";

jest.mock("@akashnetwork/logging");

describe(DrainingDeploymentService.name, () => {
  let blockHttpService: BlockHttpService;
  let leaseRepository: LeaseRepository;
  let service: DrainingDeploymentService;
  const config: DeploymentConfig = {
    AUTO_TOP_UP_JOB_INTERVAL_IN_H: 1,
    AUTO_TOP_UP_DEPLOYMENT_INTERVAL_IN_DAYS: 1
  };
  let drainingDeployment: DrainingDeploymentOutput[];
  const CURRENT_BLOCK_HEIGHT = 7481457;

  beforeEach(() => {
    blockHttpService = {
      getCurrentHeight: jest.fn().mockResolvedValue(CURRENT_BLOCK_HEIGHT)
    } as unknown as BlockHttpService;
    leaseRepository = new LeaseRepository();
    service = new DrainingDeploymentService(blockHttpService, leaseRepository, config);

    drainingDeployment = Array.from({ length: faker.number.int({ min: 1, max: 10 }) }, () => DrainingDeploymentSeeder.create());
    jest.spyOn(leaseRepository, "findDrainingLeases").mockResolvedValue(drainingDeployment);
  });

  it("should find draining deployments with usdc denom", async () => {
    const owner = AkashAddressSeeder.create();
    const denom = USDC_IBC_DENOMS.sandboxId;
    const result = await service.findDeployments(owner, denom);

    expect(leaseRepository.findDrainingLeases).toHaveBeenCalledWith({ owner, closureHeight: 7482040, denom: "uusdc" });
    expect(result).toEqual(drainingDeployment);
  });

  it("should find draining deployments with uakt denom", async () => {
    const owner = AkashAddressSeeder.create();
    const denom = "uakt";
    const result = await service.findDeployments(owner, denom);

    expect(leaseRepository.findDrainingLeases).toHaveBeenCalledWith({ owner, closureHeight: 7482040, denom });
    expect(result).toEqual(drainingDeployment);
  });

  it("should calculate top up amount", async () => {
    const result = await service.calculateTopUpAmount({ blockRate: 50 });

    expect(result).toBe(699708);
  });
});
