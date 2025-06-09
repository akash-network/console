import type { MongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { Test } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";
import merge from "lodash/merge";

import { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { DeploymentAlertService } from "@src/modules/alert/services/deployment-alert/deployment-alert.service";

import { MockProvider } from "@test/mocks/provider.mock";
import { mockAkashAddress } from "@test/seeders/akash-address.seeder";
import { generateChainMessageAlert } from "@test/seeders/chain-message-alert.seeder";
import { generateDeploymentBalanceAlertInput, generateDeploymentBalanceAlertOutput } from "@test/seeders/deployment-alert.seeder";
import { generateDeploymentBalanceAlert } from "@test/seeders/deployment-balance-alert.seeder";

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

      expect(result).toEqual(output);
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
        summary: `Deployment ${input.dseq} balance is below threshold`,
        description: `Deployment ${input.dseq} balance is below threshold`
      });
      expect(alertRepository.create).toHaveBeenCalledWith({
        name: `Deployment ${input.dseq} closed`,
        userId,
        notificationChannelId: input.alerts.deploymentClosed.notificationChannelId,
        enabled: input.alerts.deploymentClosed.enabled,
        type: "CHAIN_MESSAGE",
        params: {
          dseq: input.dseq,
          type: "DEPLOYMENT_CLOSED"
        },
        conditions: {
          value: [
            {
              field: "value.id.owner",
              value: input.owner,
              operator: "eq"
            },
            {
              field: "type",
              value: "akash.deployment.v1beta3.MsgCloseDeployment",
              operator: "eq"
            }
          ],
          operator: "and"
        },
        summary: `Deployment ${input.dseq} is closed`,
        description: `Deployment ${input.dseq} is closed`
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

      expect(result).toEqual(output);
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
      const deploymentClosedRawAlert = generateChainMessageAlert({
        params: {
          dseq,
          type: "DEPLOYMENT_CLOSED"
        },
        conditions: {
          value: [
            {
              field: "value.id.owner",
              value: owner,
              operator: "eq"
            },
            {
              field: "type",
              value: "akash.deployment.v1beta3.MsgCloseDeployment",
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
            status: deploymentBalanceRawAlert.status
          },
          deploymentClosed: {
            notificationChannelId: deploymentClosedRawAlert.notificationChannelId,
            enabled: deploymentClosedRawAlert.enabled,
            id: deploymentClosedRawAlert.id,
            status: deploymentClosedRawAlert.status
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
      providers: [DeploymentAlertService, MockProvider(AlertRepository)]
    }).compile();
    const alertRepository = module.get<MockProxy<AlertRepository>>(AlertRepository);
    const service = module.get<DeploymentAlertService>(DeploymentAlertService);

    alertRepository.accessibleBy.mockReturnValue(alertRepository);

    return {
      module,
      alertRepository,
      service
    };
  }
});
