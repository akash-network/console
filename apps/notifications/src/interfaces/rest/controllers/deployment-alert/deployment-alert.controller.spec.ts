import { generateMock } from "@anatine/zod-mock";
import { faker } from "@faker-js/faker";
import { NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { Ok } from "ts-results";
import { describe, expect, it } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import { AuthService } from "@src/interfaces/rest/services/auth/auth.service";
import { DeploymentAlertService } from "@src/modules/alert/services/deployment-alert/deployment-alert.service";
import {
  type NotificationChannelOutput,
  NotificationChannelRepository
} from "@src/modules/notifications/repositories/notification-channel/notification-channel.repository";
import { DeploymentAlertController, DeploymentAlertCreateInput, DeploymentAlertsResponse } from "./deployment-alert.controller";

import { MockProvider } from "@test/mocks/provider.mock";

describe(DeploymentAlertController.name, () => {
  it("should call deploymentAlertService.upsert() and return result", async () => {
    const { controller, service, authService, notificationChannelRepository } = await setup();
    notificationChannelRepository.findAttachableById.mockResolvedValue(mock<NotificationChannelOutput>());
    const dseq = faker.string.numeric({ length: 8, allowLeadingZeros: false });
    const input = generateMock(DeploymentAlertCreateInput.schema);
    const output = generateMock(DeploymentAlertsResponse.schema);

    service.upsert.mockResolvedValue(Ok(output.data));

    const result = await controller.upsertDeploymentAlert(dseq, input);

    expect(service.upsert).toHaveBeenCalledWith(expect.objectContaining({ ...input.data, dseq }), authService);
    expect(result).toEqual(Ok(output));
  });

  it("answers 404 without upserting when a notification channel cannot be attached", async () => {
    const { controller, service, authService, notificationChannelRepository } = await setup();
    const input = generateMock(DeploymentAlertCreateInput.schema);
    notificationChannelRepository.findAttachableById.mockResolvedValue(undefined);

    await expect(controller.upsertDeploymentAlert("1234", input)).rejects.toThrow(NotFoundException);
    expect(notificationChannelRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
    expect(notificationChannelRepository.findAttachableById).toHaveBeenCalledWith(expect.any(String), {
      organizationId: authService.organizationId,
      acceptsUnattributed: false
    });
    expect(service.upsert).not.toHaveBeenCalled();
  });

  it("checks every notification channel the alerts would notify", async () => {
    const { controller, service, notificationChannelRepository } = await setup();
    const input = generateMock(DeploymentAlertCreateInput.schema);
    notificationChannelRepository.findAttachableById.mockResolvedValue(mock<NotificationChannelOutput>());
    service.upsert.mockResolvedValue(Ok(generateMock(DeploymentAlertsResponse.schema).data));

    await controller.upsertDeploymentAlert("1234", input);

    expect(notificationChannelRepository.findAttachableById.mock.calls.map(([id]) => id).sort()).toEqual(
      [...new Set([input.data.alerts.deploymentBalance?.notificationChannelId, input.data.alerts.deploymentClosed?.notificationChannelId])]
        .filter(id => id !== undefined)
        .sort()
    );
  });

  it("should call deploymentAlertService.get() and return result", async () => {
    const { controller, service, authService } = await setup();
    const dseq = faker.string.numeric({ length: 8, allowLeadingZeros: false });
    const output = generateMock(DeploymentAlertsResponse.schema);

    service.get.mockResolvedValue(output.data);

    const result = await controller.listDeploymentAlerts(dseq);

    expect(service.get).toHaveBeenCalledWith(dseq, authService.ability);
    expect(result).toEqual(Ok(output));
  });

  async function setup() {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeploymentAlertController],
      providers: [
        MockProvider(DeploymentAlertService),
        MockProvider(NotificationChannelRepository),
        MockProvider(AuthService, { organizationId: faker.string.uuid(), reachesUnattributedRows: false })
      ]
    }).compile();
    const notificationChannelRepository = module.get<MockProxy<NotificationChannelRepository>>(NotificationChannelRepository);
    notificationChannelRepository.accessibleBy.mockReturnValue(notificationChannelRepository);

    return {
      controller: module.get(DeploymentAlertController),
      service: module.get<MockProxy<DeploymentAlertService>>(DeploymentAlertService),
      authService: module.get<MockProxy<AuthService>>(AuthService),
      notificationChannelRepository
    };
  }
});
