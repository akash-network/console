import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/common/services/logger/logger.service";
import type { AlertRepository } from "@src/modules/alert/repositories/alert/alert.repository";
import { InternalDeploymentAlertController } from "./internal-deployment-alert.controller";

import { mockAkashAddress } from "@test/seeders/akash-address.seeder";

describe(InternalDeploymentAlertController.name, () => {
  it("moves the alerts of the owner's deployment in the organization into the project", async () => {
    const { controller, alertRepository, organizationId, owner, dseq, projectId } = setup({ alertsMoved: 2 });

    await controller.moveDeploymentAlertsToProject(organizationId, dseq, { data: { owner, projectId } });

    expect(alertRepository.moveDeploymentAlertsToProject).toHaveBeenCalledWith({ organizationId, deployment: { owner, dseq }, projectId });
  });

  it("logs how many alerts moved under its own context", async () => {
    const { controller, loggerService, organizationId, owner, dseq, projectId } = setup({ alertsMoved: 2 });

    await controller.moveDeploymentAlertsToProject(organizationId, dseq, { data: { owner, projectId } });

    expect(loggerService.setContext).toHaveBeenCalledWith(InternalDeploymentAlertController.name);
    expect(loggerService.log).toHaveBeenCalledWith({ event: "DEPLOYMENT_ALERTS_MOVED_TO_PROJECT", organizationId, owner, dseq, projectId, alertsMoved: 2 });
  });

  function setup(input: { alertsMoved: number }) {
    const alertRepository = mock<AlertRepository>();
    alertRepository.moveDeploymentAlertsToProject.mockResolvedValue(input.alertsMoved);
    const loggerService = mock<LoggerService>();
    const controller = new InternalDeploymentAlertController(alertRepository, loggerService);

    return {
      controller,
      alertRepository,
      loggerService,
      organizationId: faker.string.uuid(),
      owner: mockAkashAddress(),
      dseq: faker.string.numeric({ length: 8, allowLeadingZeros: false }),
      projectId: faker.string.uuid()
    };
  }
});
