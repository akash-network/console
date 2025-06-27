import type { DeploymentInfo, RestAkashLeaseListResponse } from "@akashnetwork/http-sdk";
import { LeaseHttpService } from "@akashnetwork/http-sdk";
import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { Test } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";
import { Ok } from "ts-results";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { DeploymentService } from "./deployment.service";

import { MockProvider } from "@test/mocks/provider.mock";
import { mockAkashAddress } from "@test/seeders/akash-address.seeder";

describe(DeploymentService.name, () => {
  describe("getDeploymentBalance", () => {
    it("should return the deployment calculated escrow balance", async () => {
      const { service, deploymentHttpService, CURRENT_HEIGHT, leaseHttpService } = await setup();
      deploymentHttpService.findByOwnerAndDseq.mockResolvedValue({
        deployment: {
          state: "active"
        },
        escrow_account: {
          state: "overdrawn",
          balance: {
            denom: "uakt",
            amount: "400000"
          },
          funds: {
            denom: "uakt",
            amount: "400000"
          },
          settled_at: "900"
        }
      } as DeploymentInfo);
      const owner = mockAkashAddress();
      const dseq = faker.string.alphanumeric(6);
      leaseHttpService.list.mockResolvedValue({
        leases: [
          {
            lease: {
              price: {
                amount: "1000"
              }
            }
          }
        ]
      } as RestAkashLeaseListResponse);
      const balance = await service.getDeploymentBalance(owner, dseq, CURRENT_HEIGHT);

      expect(balance).toEqual(Ok({ balance: 700000 }));

      expect(deploymentHttpService.findByOwnerAndDseq).toHaveBeenCalledWith(owner, dseq);
    });

    it("should return null if deployment is closed", async () => {
      const { service, deploymentHttpService, leaseHttpService, CURRENT_HEIGHT } = await setup();
      deploymentHttpService.findByOwnerAndDseq.mockResolvedValue({
        deployment: {
          state: "closed"
        },
        escrow_account: {
          state: "overdrawn",
          balance: {
            denom: "uakt",
            amount: "1000"
          },
          funds: {
            denom: "uakt",
            amount: "1000"
          }
        }
      } as DeploymentInfo);
      const owner = mockAkashAddress();
      const dseq = faker.string.alphanumeric(6);
      leaseHttpService.list.mockResolvedValue({ leases: [] } as unknown as RestAkashLeaseListResponse);

      const balance = await service.getDeploymentBalance(owner, dseq, CURRENT_HEIGHT);

      expect(balance).toMatchObject({
        err: true,
        val: {
          message: "Deployment closed",
          code: "DEPLOYMENT_CLOSED"
        }
      });
      expect(deploymentHttpService.findByOwnerAndDseq).toHaveBeenCalledWith(owner, dseq);
    });
  });

  async function setup() {
    const module = await Test.createTestingModule({
      providers: [DeploymentService, MockProvider(DeploymentHttpService), MockProvider(LeaseHttpService), MockProvider(LoggerService)]
    }).compile();

    return {
      module,
      service: module.get<DeploymentService>(DeploymentService),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService),
      deploymentHttpService: module.get<MockProxy<DeploymentHttpService>>(DeploymentHttpService),
      leaseHttpService: module.get<MockProxy<LeaseHttpService>>(LeaseHttpService),
      CURRENT_HEIGHT: 1000
    };
  }
});
