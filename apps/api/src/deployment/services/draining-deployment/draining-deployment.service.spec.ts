import "@test/mocks/logger-service.mock";

import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { AutoTopUpDeployment, DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { averageBlockCountInAnHour } from "@src/utils/constants";
import { DrainingDeploymentService } from "./draining-deployment.service";

import { MockConfigService } from "@test/mocks/config-service.mock";
import { AutoTopUpDeploymentSeeder } from "@test/seeders/auto-top-up-deployment.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";

jest.mock("@akashnetwork/logging");

type DeploymentConfigValues = {
  AUTO_TOP_UP_JOB_INTERVAL_IN_H: number;
  AUTO_TOP_UP_DEPLOYMENT_INTERVAL_IN_H: number;
};

describe(DrainingDeploymentService.name, () => {
  let blockHttpService: jest.Mocked<BlockHttpService>;
  let leaseRepository: jest.Mocked<LeaseRepository>;
  let deploymentSettingRepository: jest.Mocked<DeploymentSettingRepository>;
  let service: DrainingDeploymentService;
  let config: MockConfigService<DeploymentConfigValues>;
  const CURRENT_BLOCK_HEIGHT = 7481457;

  beforeEach(() => {
    blockHttpService = {
      getCurrentHeight: jest.fn().mockResolvedValue(CURRENT_BLOCK_HEIGHT),
      getFutureBlockHeight: jest.fn()
    } as Partial<jest.Mocked<BlockHttpService>> as jest.Mocked<BlockHttpService>;

    leaseRepository = {
      findManyByDseqAndOwner: jest.fn()
    } as Partial<jest.Mocked<LeaseRepository>> as jest.Mocked<LeaseRepository>;

    deploymentSettingRepository = {
      paginateAutoTopUpDeployments: jest.fn()
    } as Partial<jest.Mocked<DeploymentSettingRepository>> as jest.Mocked<DeploymentSettingRepository>;

    config = new MockConfigService<DeploymentConfigValues>({
      AUTO_TOP_UP_JOB_INTERVAL_IN_H: 1,
      AUTO_TOP_UP_DEPLOYMENT_INTERVAL_IN_H: 3
    });

    service = new DrainingDeploymentService(blockHttpService, leaseRepository, deploymentSettingRepository, config);
  });

  describe("paginate", () => {
    const CURRENT_HEIGHT = 1000000;
    const LIMIT = 10;
    const BLOCK_RATE_1 = 50;
    const BLOCK_RATE_2 = 75;
    const PREDICTED_CLOSURE_OFFSET_1 = 100;
    const PREDICTED_CLOSURE_OFFSET_2 = 200;

    beforeEach(() => {
      (blockHttpService.getCurrentHeight as jest.Mock).mockResolvedValue(CURRENT_HEIGHT);
    });

    it("should paginate draining deployments", async () => {
      const deploymentSettings = AutoTopUpDeploymentSeeder.createMany(2);
      const addresses = deploymentSettings.map(s => s.address);
      const dseqs = deploymentSettings.map(s => Number(s.dseq));

      const drainingDeployments = [
        DrainingDeploymentSeeder.create({
          dseq: dseqs[0],
          owner: addresses[0],
          predictedClosedHeight: CURRENT_HEIGHT + PREDICTED_CLOSURE_OFFSET_1,
          blockRate: BLOCK_RATE_1
        }),
        DrainingDeploymentSeeder.create({
          dseq: dseqs[1],
          owner: addresses[1],
          predictedClosedHeight: CURRENT_HEIGHT + PREDICTED_CLOSURE_OFFSET_2,
          blockRate: BLOCK_RATE_2
        })
      ];

      (deploymentSettingRepository.paginateAutoTopUpDeployments as jest.Mock).mockImplementation(
        async (_: { limit: number }, callback: (settings: AutoTopUpDeployment[]) => Promise<void>) => {
          await callback(deploymentSettings);
        }
      );

      (leaseRepository.findManyByDseqAndOwner as jest.Mock).mockResolvedValue(drainingDeployments);

      const callback = jest.fn();
      await service.paginate({ limit: LIMIT }, callback);

      const expectedClosureHeight = Math.floor(CURRENT_HEIGHT + averageBlockCountInAnHour * config.get("AUTO_TOP_UP_JOB_INTERVAL_IN_H"));

      expect(blockHttpService.getCurrentHeight).toHaveBeenCalled();
      expect(deploymentSettingRepository.paginateAutoTopUpDeployments).toHaveBeenCalledWith({ limit: LIMIT }, expect.any(Function));
      expect(leaseRepository.findManyByDseqAndOwner).toHaveBeenCalledWith(
        expectedClosureHeight,
        expect.arrayContaining([
          { dseq: String(dseqs[0]), owner: addresses[0] },
          { dseq: String(dseqs[1]), owner: addresses[1] }
        ])
      );
      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            dseq: dseqs[0].toString(),
            address: addresses[0],
            predictedClosedHeight: CURRENT_HEIGHT + PREDICTED_CLOSURE_OFFSET_1,
            blockRate: BLOCK_RATE_1
          }),
          expect.objectContaining({
            dseq: dseqs[1].toString(),
            address: addresses[1],
            predictedClosedHeight: CURRENT_HEIGHT + PREDICTED_CLOSURE_OFFSET_2,
            blockRate: BLOCK_RATE_2
          })
        ])
      );
    });

    it("should not call callback if no draining deployments found", async () => {
      (deploymentSettingRepository.paginateAutoTopUpDeployments as jest.Mock).mockImplementation(
        async (_: { limit: number }, callback: (settings: AutoTopUpDeployment[]) => Promise<void>) => {
          await callback([]);
        }
      );

      (leaseRepository.findManyByDseqAndOwner as jest.Mock).mockResolvedValue([]);

      const callback = jest.fn();
      await service.paginate({ limit: LIMIT }, callback);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("calculateTopUpAmount", () => {
    const TEST_CASES = [
      {
        name: "should calculate amount for integer block rate",
        input: { blockRate: 50 },
        expected: 87463
      },
      {
        name: "should floor decimal block rate",
        input: { blockRate: 10.7 },
        expected: 18717
      }
    ];

    TEST_CASES.forEach(testCase => {
      it(testCase.name, async () => {
        const result = await service.calculateTopUpAmount(testCase.input);
        expect(result).toBe(testCase.expected);
      });
    });
  });
});
