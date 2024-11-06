import { faker } from "@faker-js/faker";

import { DeploymentConfig } from "@src/deployment/config/config.provider";
import { DrainingDeploymentOutput, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { BlockHttpService } from "../block-http/block-http.service";
import { DrainingDeploymentService } from "./draining-deployment.service";

import { AkashAddressSeeder } from "@test/seeders/akash-address.seeder";
import { DenomSeeder } from "@test/seeders/denom.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";

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

  it("should find draining deployments", async () => {
    const owner = AkashAddressSeeder.create();
    const denom = DenomSeeder.create();
    const result = await service.findDeployments(owner, denom);

    expect(leaseRepository.findDrainingLeases).toHaveBeenCalledWith({ owner, closureHeight: 7482040, denom });
    expect(result).toEqual(drainingDeployment);
  });

  it("should calculate top up amount", async () => {
    const result = await service.calculateTopUpAmount({ blockRate: 50 });

    expect(result).toBe(699708);
  });
});
