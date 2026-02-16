import { faker } from "@faker-js/faker";
import { ConfigModule } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { register } from "@src/infrastructure/db/db.module";
import * as schema from "@src/modules/notifications/model-schemas";
import { NotificationChannelRepository } from "./notification-channel.repository";

import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";
import { TestDatabaseService } from "@test/services/test-database.service";

describe(NotificationChannelRepository.name, () => {
  const testDbService = new TestDatabaseService(expect.getState().testPath!);

  beforeAll(async () => {
    await testDbService.setup();
  });

  afterAll(async () => {
    await testDbService.teardown();
  });

  describe("createDefaultChannel", () => {
    it("creates only 1 default notification channel per user", async () => {
      const module = await setup();
      const repository = module.get(NotificationChannelRepository);
      const userId = faker.string.uuid();

      await Promise.all([
        repository.createDefaultChannel({
          name: "Default",
          type: "email",
          userId,
          config: {
            addresses: ["test@test.com"]
          }
        }),
        repository.createDefaultChannel({
          name: "Default",
          type: "email",
          userId,
          config: {
            addresses: ["test2@test.com"]
          }
        })
      ]);

      const channels = await repository.paginate({ userId, limit: 100 });
      expect(channels.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId,
            isDefault: true
          })
        ])
      );
    });

    it("creates a default notification channel if there is deleted one", async () => {
      const module = await setup();
      const repository = module.get(NotificationChannelRepository);
      const userId = faker.string.uuid();
      const { isDefault, ...channel } = generateNotificationChannel({ userId });

      await repository.createDefaultChannel(channel);
      await repository.deleteSafelyById(channel.id);

      const newChannel = { ...channel, id: faker.string.uuid() };
      await repository.createDefaultChannel(newChannel);

      const result = await repository.findDefaultByUserId(userId);

      expect(result).toEqual({
        ...newChannel,
        isDefault: true
      });
    });
  });

  describe("findDefaultByUserId", () => {
    it("returns the default notification channel for the user", async () => {
      const module = await setup();
      const repository = module.get(NotificationChannelRepository);
      const userId = faker.string.uuid();
      const { isDefault, ...channel } = generateNotificationChannel({ userId });

      await repository.createDefaultChannel(channel);

      const result = await repository.findDefaultByUserId(userId);

      expect(result).toEqual({
        ...channel,
        isDefault: true
      });
    });

    it("returns undefined if no default notification channel exists for the user", async () => {
      const module = await setup();
      const repository = module.get(NotificationChannelRepository);
      const userId = faker.string.uuid();

      const result = await repository.findDefaultByUserId(userId);

      expect(result).toBeUndefined();
    });

    it("returns undefined if there is a soft deleted default notification channel", async () => {
      const module = await setup();
      const repository = module.get(NotificationChannelRepository);
      const userId = faker.string.uuid();
      const { isDefault, ...channel } = generateNotificationChannel({ userId });

      await repository.createDefaultChannel(channel);
      await repository.deleteSafelyById(channel.id);

      const result = await repository.findDefaultByUserId(userId);

      expect(result).toBeUndefined();
    });
  });

  let testModule: TestingModule | undefined;
  afterEach(async () => {
    await testModule?.get(DRIZZLE_PROVIDER_TOKEN).session.client.end();
    await testModule?.close();
  });

  async function setup() {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), ...register(schema)],
      providers: [NotificationChannelRepository]
    }).compile();
    testModule = module;

    return module;
  }
});
