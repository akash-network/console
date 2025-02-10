import "@test/mocks/logger-service.mock";

import { faker } from "@faker-js/faker";

import { UserWalletRepository } from "@src/billing/repositories";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { AutoTopUpDeployment, DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { averageBlockCountInAnHour } from "@src/utils/constants";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import { DrainingDeploymentService } from "./draining-deployment.service";

import { AkashAddressSeeder } from "@test/seeders/akash-address.seeder";
import { AutoTopUpDeploymentSeeder } from "@test/seeders/auto-top-up-deployment.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

jest.mock("@akashnetwork/logging");

describe(DrainingDeploymentService.name, () => {
  let blockHttpService: jest.Mocked<BlockHttpService>;
  let leaseRepository: jest.Mocked<LeaseRepository>;
  let userWalletRepository: jest.Mocked<UserWalletRepository>;
  let deploymentSettingRepository: jest.Mocked<DeploymentSettingRepository>;
  let service: DrainingDeploymentService;
  let config: jest.Mocked<DeploymentConfigService>;
  const CURRENT_BLOCK_HEIGHT = 7481457;

  beforeEach(() => {
    blockHttpService = {
      getCurrentHeight: jest.fn().mockResolvedValue(CURRENT_BLOCK_HEIGHT),
      getFutureBlockHeight: jest.fn()
    } as Partial<jest.Mocked<BlockHttpService>> as jest.Mocked<BlockHttpService>;

    leaseRepository = {
      findManyByDseqAndOwner: jest.fn(),
      findOneByDseqAndOwner: jest.fn()
    } as Partial<jest.Mocked<LeaseRepository>> as jest.Mocked<LeaseRepository>;

    userWalletRepository = {
      findOneByUserId: jest.fn()
    } as Partial<jest.Mocked<UserWalletRepository>> as jest.Mocked<UserWalletRepository>;

    deploymentSettingRepository = {
      paginateAutoTopUpDeployments: jest.fn(),
      updateManyById: jest.fn()
    } as Partial<jest.Mocked<DeploymentSettingRepository>> as jest.Mocked<DeploymentSettingRepository>;

    const configValues = {
      AUTO_TOP_UP_JOB_INTERVAL_IN_H: 1,
      AUTO_TOP_UP_DEPLOYMENT_INTERVAL_IN_H: 3
    };

    config = {
      get: jest.fn().mockImplementation((key: keyof typeof configValues) => configValues[key]),
      config: configValues
    } as unknown as jest.Mocked<DeploymentConfigService>;

    service = new DrainingDeploymentService(blockHttpService, leaseRepository, userWalletRepository, deploymentSettingRepository, config);
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

    it("should paginate draining deployments and mark closed ones as such", async () => {
      const deploymentSettings = AutoTopUpDeploymentSeeder.createMany(4);
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
          blockRate: BLOCK_RATE_2,
          closedHeight: CURRENT_HEIGHT - 100
        }),
        DrainingDeploymentSeeder.create({
          dseq: dseqs[3],
          owner: addresses[3],
          predictedClosedHeight: CURRENT_HEIGHT + PREDICTED_CLOSURE_OFFSET_1,
          blockRate: BLOCK_RATE_1
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
          { dseq: String(dseqs[1]), owner: addresses[1] },
          { dseq: String(dseqs[2]), owner: addresses[2] },
          { dseq: String(dseqs[3]), owner: addresses[3] }
        ])
      );

      expect(deploymentSettingRepository.updateManyById).toHaveBeenCalledWith(expect.arrayContaining([deploymentSettings[1].id]), { closed: true });

      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            dseq: dseqs[0].toString(),
            address: addresses[0],
            predictedClosedHeight: CURRENT_HEIGHT + PREDICTED_CLOSURE_OFFSET_1,
            blockRate: BLOCK_RATE_1
          }),
          expect.objectContaining({
            dseq: dseqs[3].toString(),
            address: addresses[3],
            predictedClosedHeight: CURRENT_HEIGHT + PREDICTED_CLOSURE_OFFSET_1,
            blockRate: BLOCK_RATE_1
          })
        ])
      );
      expect(callback.mock.calls[0][0]).toHaveLength(2);
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
      expect(deploymentSettingRepository.updateManyById).not.toHaveBeenCalled();
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

  describe("calculateTopUpAmountForDseqAndUserId", () => {
    const userId = faker.string.uuid();
    const dseq = faker.string.numeric(6);
    const address = AkashAddressSeeder.create();
    const userWallet = UserWalletSeeder.create({ address });
    const expectedTopUpAmount = 100000;

    beforeEach(() => {
      userWalletRepository.findOneByUserId.mockResolvedValue(userWallet);
      jest.spyOn(service, "calculateTopUpAmount").mockResolvedValue(expectedTopUpAmount);
    });

    it("should calculate top up amount for valid deployment", async () => {
      const deployment = DrainingDeploymentSeeder.create();
      leaseRepository.findOneByDseqAndOwner.mockResolvedValue(deployment);

      const amount = await service.calculateTopUpAmountForDseqAndUserId(dseq, userId);

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(userId);
      expect(leaseRepository.findOneByDseqAndOwner).toHaveBeenCalledWith(dseq, address);
      expect(service.calculateTopUpAmount).toHaveBeenCalledWith(deployment);
      expect(amount).toBe(expectedTopUpAmount);
    });

    it("should return 0 if user wallet not found", async () => {
      userWalletRepository.findOneByUserId.mockResolvedValue(null);

      const amount = await service.calculateTopUpAmountForDseqAndUserId(dseq, userId);

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(userId);
      expect(leaseRepository.findOneByDseqAndOwner).not.toHaveBeenCalled();
      expect(service.calculateTopUpAmount).not.toHaveBeenCalled();
      expect(amount).toBe(0);
    });

    it("should return 0 if lease not found", async () => {
      leaseRepository.findOneByDseqAndOwner.mockResolvedValue(null);

      const amount = await service.calculateTopUpAmountForDseqAndUserId(dseq, userId);

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(userId);
      expect(leaseRepository.findOneByDseqAndOwner).toHaveBeenCalledWith(dseq, address);
      expect(service.calculateTopUpAmount).not.toHaveBeenCalled();
      expect(amount).toBe(0);
    });
  });
});
