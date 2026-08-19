import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { DeploymentSettingService } from "@src/deployment/services/deployment-setting/deployment-setting.service";
import { DeploymentSettingController } from "./deployment-setting.controller";

import { createUser } from "@test/seeders/user.seeder";

describe(DeploymentSettingController.name, () => {
  describe("findOrCreateV2", () => {
    it("uses provided userId", async () => {
      const { controller, deploymentSettingService, setting } = setup();
      const userId = faker.string.uuid();
      const dseq = faker.string.numeric(6);
      deploymentSettingService.findOrCreateByUserIdAndDseq.mockResolvedValue(setting);

      const result = await controller.findOrCreateV2({ dseq, userId });

      expect(result).toEqual({ data: setting });
      expect(deploymentSettingService.findOrCreateByUserIdAndDseq).toHaveBeenCalledWith({ userId, dseq });
    });

    it("defaults userId to current user when not provided", async () => {
      const { controller, deploymentSettingService, setting, user } = setup();
      const dseq = faker.string.numeric(6);
      deploymentSettingService.findOrCreateByUserIdAndDseq.mockResolvedValue(setting);

      const result = await controller.findOrCreateV2({ dseq });

      expect(result).toEqual({ data: setting });
      expect(deploymentSettingService.findOrCreateByUserIdAndDseq).toHaveBeenCalledWith({ userId: user.id, dseq });
    });

    it("throws 404 when setting not found", async () => {
      const { controller, deploymentSettingService } = setup();
      deploymentSettingService.findOrCreateByUserIdAndDseq.mockResolvedValue(undefined);

      await expect(() => controller.findOrCreateV2({ dseq: faker.string.numeric(6) })).rejects.toThrow("Deployment setting not found");
    });
  });

  describe("createV2", () => {
    it("uses provided userId", async () => {
      const { controller, deploymentSettingService, setting } = setup();
      const userId = faker.string.uuid();
      const dseq = faker.string.numeric(6);
      deploymentSettingService.create.mockResolvedValue(setting);

      const result = await controller.createV2({ dseq, autoTopUpEnabled: true, userId });

      expect(result).toEqual({ data: setting });
      expect(deploymentSettingService.create).toHaveBeenCalledWith({ dseq, autoTopUpEnabled: true, userId });
    });

    it("defaults userId to current user when not provided", async () => {
      const { controller, deploymentSettingService, setting, user } = setup();
      const dseq = faker.string.numeric(6);
      deploymentSettingService.create.mockResolvedValue(setting);

      const result = await controller.createV2({ dseq, autoTopUpEnabled: false });

      expect(result).toEqual({ data: setting });
      expect(deploymentSettingService.create).toHaveBeenCalledWith({ dseq, autoTopUpEnabled: false, userId: user.id });
    });
  });

  describe("upsertV2", () => {
    it("uses provided userId", async () => {
      const { controller, deploymentSettingService, setting } = setup();
      const userId = faker.string.uuid();
      const dseq = faker.string.numeric(6);
      deploymentSettingService.upsert.mockResolvedValue(setting);

      const result = await controller.upsertV2({ dseq, userId, autoTopUpEnabled: true });

      expect(result).toEqual({ data: setting });
      expect(deploymentSettingService.upsert).toHaveBeenCalledWith({ userId, dseq }, { autoTopUpEnabled: true });
    });

    it("defaults userId to current user when not provided", async () => {
      const { controller, deploymentSettingService, setting, user } = setup();
      const dseq = faker.string.numeric(6);
      deploymentSettingService.upsert.mockResolvedValue(setting);

      const result = await controller.upsertV2({ dseq, autoTopUpEnabled: false });

      expect(result).toEqual({ data: setting });
      expect(deploymentSettingService.upsert).toHaveBeenCalledWith({ userId: user.id, dseq }, { autoTopUpEnabled: false });
    });

    it("throws 404 when setting not found", async () => {
      const { controller, deploymentSettingService } = setup();
      deploymentSettingService.upsert.mockResolvedValue(undefined as never);

      await expect(() => controller.upsertV2({ dseq: faker.string.numeric(6), autoTopUpEnabled: true })).rejects.toThrow("Deployment setting not found");
    });
  });

  function setup() {
    const user = createUser();
    const deploymentSettingService = mock<DeploymentSettingService>();
    const authService = mock<AuthService>({
      currentUser: user
    });
    const controller = new DeploymentSettingController(deploymentSettingService, authService);
    container.register(AuthService, { useValue: authService });

    const setting = {
      id: faker.string.uuid(),
      userId: user.id,
      dseq: faker.string.numeric(6),
      autoTopUpEnabled: faker.datatype.boolean(),
      closed: false,
      estimatedTopUpAmount: faker.number.float({ min: 0, max: 100 }),
      topUpFrequencyMs: faker.number.int({ min: 1000, max: 100000 }),
      createdAt: faker.date.recent().toISOString(),
      updatedAt: faker.date.recent().toISOString()
    };

    return { controller, deploymentSettingService, authService, user, setting };
  }
});
