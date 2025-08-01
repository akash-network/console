import type { MongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";
import merge from "lodash/merge";
import { Ok } from "ts-results";

import moduleConfig from "@src/modules/alert/config";
import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { DeploymentService } from "@src/modules/alert/services/deployment/deployment.service";
import { DeploymentAlertService } from "@src/modules/alert/services/deployment-alert/deployment-alert.service";

import { MockProvider } from "@test/mocks/provider.mock";
import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateDeploymentBalanceAlertInput, generateDeploymentBalanceAlertOutput } from "@test/seeders/deployment-alert.seeder";
import { generateDeploymentBalanceAlert } from "@test/seeders/deployment-balance-alert.seeder";
import { generateGeneralAlert } from "@test/seeders/general-alert.seeder";

describe(DeploymentAlertService.name, () => {
  describe("upsert", () => {
    it("should create a new alert if it does not exist", async () => {
      const { alertRepository, service } = await setup();
      const input = generateDeploymentBalanceAlertInput({});
      const output = generateDeploymentBalanceAlertOutput({});

      jest
        .spyOn(service, "get")
        .mockResolvedValueOnce({
          dseq: input.dseq,
          alerts: {}
        })
        .mockResolvedValueOnce(output);
      const userId = faker.string.uuid();

      const result = await service.upsert(input, { ability: {} as MongoAbility, userId });

      expect(result).toEqual(Ok(output));
      expect(alertRepository.create).toHaveBeenCalledWith({
        name: `Deployment ${input.dseq} balance`,
        userId,
        notificationChannelId: input.alerts.deploymentBalance.notificationChannelId,
        enabled: input.alerts.deploymentBalance.enabled,
        type: "DEPLOYMENT_BALANCE",
        params: {
          dseq: input.dseq,
          owner: input.owner
        },
        conditions: {
          field: "balance",
          value: input.alerts.deploymentBalance.threshold,
          operator: "lt"
        },
        summary: expect.any(String),
        description: expect.any(String)
      });
      expect(alertRepository.create).toHaveBeenCalledWith({
        name: `Deployment ${input.dseq} closed`,
        userId,
        notificationChannelId: input.alerts.deploymentClosed.notificationChannelId,
        enabled: input.alerts.deploymentClosed.enabled,
        type: "CHAIN_EVENT",
        params: {
          dseq: input.dseq,
          type: "DEPLOYMENT_CLOSED"
        },
        conditions: {
          value: [
            {
              field: "action",
              value: "deployment-closed",
              operator: "eq"
            },
            {
              field: "owner",
              value: input.owner,
              operator: "eq"
            },
            {
              field: "dseq",
              value: input.dseq,
              operator: "eq"
            }
          ],
          operator: "and"
        },
        summary: expect.any(String),
        description: expect.any(String)
      });
    });

    it("should update alerts if exist", async () => {
      const { alertRepository, service } = await setup();
      const existing = generateDeploymentBalanceAlertOutput({});
      const input = {
        dseq: existing.dseq,
        owner: mockAkashAddress(),
        alerts: {
          deploymentBalance: {
            notificationChannelId: faker.string.uuid(),
            enabled: !existing.alerts.deploymentBalance.enabled,
            threshold: faker.number.int({ min: 1, max: 1000000 })
          },
          deploymentClosed: {
            notificationChannelId: faker.string.uuid(),
            enabled: !existing.alerts.deploymentClosed.enabled
          }
        }
      };

      const output = merge({}, existing, input);

      jest.spyOn(service, "get").mockResolvedValueOnce(existing).mockResolvedValueOnce(output);
      const userId = faker.string.uuid();

      const result = await service.upsert(input, { ability: {} as MongoAbility, userId });

      expect(result).toEqual(Ok(output));
      expect(alertRepository.updateById).toHaveBeenCalledWith(existing.alerts.deploymentBalance.id, {
        notificationChannelId: input.alerts.deploymentBalance.notificationChannelId,
        enabled: input.alerts.deploymentBalance.enabled,
        conditions: {
          field: "balance",
          value: input.alerts.deploymentBalance.threshold,
          operator: "lt"
        }
      });
      expect(alertRepository.updateById).toHaveBeenCalledWith(existing.alerts.deploymentClosed.id, {
        notificationChannelId: input.alerts.deploymentClosed.notificationChannelId,
        enabled: input.alerts.deploymentClosed.enabled
      });
    });
  });

  describe("get", () => {
    it("should retrieve and summarise alerts", async () => {
      const { alertRepository, service } = await setup();
      const dseq = faker.string.numeric();
      const owner = mockAkashAddress();
      const deploymentBalanceRawAlert = generateDeploymentBalanceAlert({
        params: {
          dseq,
          owner
        }
      });
      const deploymentClosedRawAlert = generateGeneralAlert({
        type: "CHAIN_EVENT",
        params: {
          dseq,
          type: "DEPLOYMENT_CLOSED"
        },
        conditions: {
          value: [
            {
              field: "action",
              value: "deployment-closed",
              operator: "eq"
            },
            {
              field: "owner",
              value: owner,
              operator: "eq"
            },
            {
              field: "dseq",
              value: dseq,
              operator: "eq"
            }
          ],
          operator: "and"
        }
      });
      alertRepository.findAllDeploymentAlerts.mockResolvedValueOnce([deploymentBalanceRawAlert, deploymentClosedRawAlert]);

      expect(await service.get(dseq, {} as MongoAbility)).toEqual({
        dseq,
        alerts: {
          deploymentBalance: {
            notificationChannelId: deploymentBalanceRawAlert.notificationChannelId,
            enabled: deploymentBalanceRawAlert.enabled,
            threshold: deploymentBalanceRawAlert.conditions.value,
            id: deploymentBalanceRawAlert.id,
            status: deploymentBalanceRawAlert.status,
            suppressedBySystem: false
          },
          deploymentClosed: {
            notificationChannelId: deploymentClosedRawAlert.notificationChannelId,
            enabled: deploymentClosedRawAlert.enabled,
            id: deploymentClosedRawAlert.id,
            status: deploymentClosedRawAlert.status,
            suppressedBySystem: false
          }
        }
      });
    });

    it("should retrieve and summarise empty result", async () => {
      const { alertRepository, service } = await setup();
      alertRepository.findAllDeploymentAlerts.mockResolvedValueOnce([]);
      const dseq = faker.string.numeric();

      expect(await service.get(dseq, {} as MongoAbility)).toEqual({
        dseq,
        alerts: {}
      });
    });
  });

  async function setup() {
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forFeature(moduleConfig)],
      providers: [DeploymentAlertService, MockProvider(AlertRepository), MockProvider(DeploymentService)]
    }).compile();
    const alertRepository = module.get<MockProxy<AlertRepository>>(AlertRepository);
    const service = module.get<DeploymentAlertService>(DeploymentAlertService);

    alertRepository.accessibleBy.mockReturnValue(alertRepository);
    module.get<MockProxy<DeploymentService>>(DeploymentService).deploymentExists.mockResolvedValue(true);

    return {
      module,
      alertRepository,
      service
    };
  }
});
