import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import { Test, type TestingModule } from "@nestjs/testing";
import type { MockProxy } from "jest-mock-extended";
import { Ok } from "ts-results";

import { AuthService } from "@src/interfaces/rest/services/auth/auth.service";
import { DeploymentAlertService } from "@src/modules/alert/services/deployment-alert/deployment-alert.service";
import { DeploymentAlertController, DeploymentAlertCreateInput, DeploymentAlertsResponse } from "./deployment-alert.controller";

import { MockProvider } from "@test/mocks/provider.mock";

describe(DeploymentAlertController.name, () => {
  it("should call deploymentAlertService.upsert() and return result", async () => {
    const { controller, service, authService } = await setup();
    const dseq = faker.string.numeric();
    const input = generateMock(DeploymentAlertCreateInput.schema);
    const output = generateMock(DeploymentAlertsResponse.schema);

    service.upsert.mockResolvedValue(Ok(output.data));

    const result = await controller.upsertDeploymentAlert(dseq, input);

    expect(service.upsert).toHaveBeenCalledWith(expect.objectContaining({ ...input.data, dseq }), authService);
    expect(result).toEqual(Ok(output));
  });

  it("should call deploymentAlertService.get() and return result", async () => {
    const { controller, service, authService } = await setup();
    const dseq = faker.string.numeric();
    const output = generateMock(DeploymentAlertsResponse.schema);

    service.get.mockResolvedValue(output.data);

    const result = await controller.getDeploymentAlerts(dseq);

    expect(service.get).toHaveBeenCalledWith(dseq, authService.ability);
    expect(result).toEqual(Ok(output));
  });

  async function setup() {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeploymentAlertController],
      providers: [MockProvider(DeploymentAlertService), MockProvider(AuthService)]
    }).compile();

    return {
      controller: module.get(DeploymentAlertController),
      service: module.get<MockProxy<DeploymentAlertService>>(DeploymentAlertService),
      authService: module.get<MockProxy<AuthService>>(AuthService)
    };
  }
});
