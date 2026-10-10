import { createMongoAbility, ForbiddenError } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { ConfigModule } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { register } from "@src/infrastructure/db/db.module";
import * as schema from "@src/modules/notifications/model-schemas";
import { type DefaultChannelOwner, type NotificationChannelInput, NotificationChannelRepository } from "./notification-channel.repository";

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
      const { repository } = await setup();
      const userId = faker.string.uuid();
      const owner: DefaultChannelOwner = { kind: "user", userId, organizationId: null };

      await Promise.all([repository.createDefaultChannel(channelInput({ userId }), owner), repository.createDefaultChannel(channelInput({ userId }), owner)]);

      expect(await liveDefaultsOf(repository, { userId })).toHaveLength(1);
    });

    it("creates a default notification channel if there is deleted one", async () => {
      const { repository } = await setup();
      const userId = faker.string.uuid();
      const owner: DefaultChannelOwner = { kind: "user", userId, organizationId: null };
      const channel = channelInput({ userId });

      await repository.createDefaultChannel(channel, owner);
      await repository.deleteSafelyById(channel.id!);

      const newChannel = { ...channel, id: faker.string.uuid() };
      await repository.createDefaultChannel(newChannel, owner);

      expect(await repository.findDefault(owner)).toEqual({ ...newChannel, isDefault: true });
    });

    it("stamps the default of a user with their organization", async () => {
      const { repository } = await setup();
      const userId = faker.string.uuid();
      const organizationId = faker.string.uuid();
      const channel = channelInput({ userId, organizationId });

      await repository.createDefaultChannel(channel, { kind: "user", userId, organizationId });

      expect(await repository.findDefault({ kind: "organization", organizationId })).toEqual({ ...channel, isDefault: true });
    });

    it("keeps a user's unattributed default instead of adding one for their organization", async () => {
      const { repository } = await setup();
      const userId = faker.string.uuid();
      const organizationId = faker.string.uuid();
      const unattributed = channelInput({ userId });

      await repository.createDefaultChannel(unattributed, { kind: "user", userId, organizationId: null });
      await repository.createDefaultChannel(channelInput({ userId, organizationId }), { kind: "user", userId, organizationId });

      expect(await liveDefaultsOf(repository, { userId })).toEqual([expect.objectContaining({ id: unattributed.id, organizationId: null })]);
    });

    it("creates only 1 default notification channel per organization, whoever asks", async () => {
      const { repository } = await setup();
      const organizationId = faker.string.uuid();
      const owner: DefaultChannelOwner = { kind: "organization", organizationId };

      await Promise.all([
        repository.createDefaultChannel(channelInput({ organizationId }), owner),
        repository.createDefaultChannel(channelInput({ organizationId }), owner)
      ]);

      expect(await liveDefaultsOf(repository, { organizationId })).toHaveLength(1);
    });

    it("refuses a default the ability does not allow to create", async () => {
      const { repository } = await setup();
      const organizationId = faker.string.uuid();
      const ability = createMongoAbility([{ action: "create", subject: "NotificationChannel", conditions: { organizationId: faker.string.uuid() } }]);

      await expect(
        repository.accessibleBy(ability, "create").createDefaultChannel(channelInput({ organizationId }), { kind: "organization", organizationId })
      ).rejects.toThrow(ForbiddenError);
      expect(await liveDefaultsOf(repository, { organizationId })).toHaveLength(0);
    });

    it("checks the ability against a default channel whatever the input says", async () => {
      const { repository } = await setup();
      const organizationId = faker.string.uuid();
      const ability = createMongoAbility([
        { action: "create", subject: "NotificationChannel", conditions: { organizationId } },
        { action: "create", subject: "NotificationChannel", conditions: { isDefault: true }, inverted: true }
      ]);

      await expect(
        repository
          .accessibleBy(ability, "create")
          .createDefaultChannel({ ...channelInput({ organizationId }), isDefault: false }, { kind: "organization", organizationId })
      ).rejects.toThrow(ForbiddenError);
      expect(await liveDefaultsOf(repository, { organizationId })).toHaveLength(0);
    });
  });

  describe("findAttachableById", () => {
    it("returns a channel of the alert's organization", async () => {
      const { repository } = await setup();
      const organizationId = faker.string.uuid();
      const channel = await repository.create(channelInput({ organizationId }));

      expect(await repository.findAttachableById(channel.id, { organizationId, acceptsUnattributed: false })).toMatchObject({ id: channel.id });
    });

    it("returns an unattributed channel only when the alert may notify one", async () => {
      const { repository } = await setup();
      const organizationId = faker.string.uuid();
      const channel = await repository.create(channelInput({}));

      expect(await repository.findAttachableById(channel.id, { organizationId, acceptsUnattributed: true })).toMatchObject({ id: channel.id });
      expect(await repository.findAttachableById(channel.id, { organizationId: null, acceptsUnattributed: true })).toMatchObject({ id: channel.id });
      expect(await repository.findAttachableById(channel.id, { organizationId, acceptsUnattributed: false })).toBeUndefined();
    });

    it("refuses a channel of another organization", async () => {
      const { repository } = await setup();
      const channel = await repository.create(channelInput({ organizationId: faker.string.uuid() }));

      expect(await repository.findAttachableById(channel.id, { organizationId: faker.string.uuid(), acceptsUnattributed: true })).toBeUndefined();
      expect(await repository.findAttachableById(channel.id, { organizationId: null, acceptsUnattributed: true })).toBeUndefined();
    });

    it("refuses a channel that does not exist", async () => {
      const { repository } = await setup();

      expect(await repository.findAttachableById(faker.string.uuid(), { organizationId: null, acceptsUnattributed: true })).toBeUndefined();
    });
  });

  describe("findDefault", () => {
    it("ignores defaults filed in an organization when the request names none", async () => {
      const { repository } = await setup();
      const userId = faker.string.uuid();
      const organizationId = faker.string.uuid();

      await repository.createDefaultChannel(channelInput({ userId, organizationId }), { kind: "organization", organizationId });

      expect(await repository.findDefault({ kind: "user", userId, organizationId: null })).toBeUndefined();
    });

    it("returns the unattributed default of a user within their organization", async () => {
      const { repository } = await setup();
      const userId = faker.string.uuid();
      const channel = channelInput({ userId });

      await repository.createDefaultChannel(channel, { kind: "user", userId, organizationId: null });

      expect(await repository.findDefault({ kind: "user", userId, organizationId: faker.string.uuid() })).toEqual({ ...channel, isDefault: true });
    });

    it("ignores the default a user created for another organization", async () => {
      const { repository } = await setup();
      const userId = faker.string.uuid();
      const teamOrganizationId = faker.string.uuid();

      await repository.createDefaultChannel(channelInput({ userId, organizationId: teamOrganizationId }), {
        kind: "organization",
        organizationId: teamOrganizationId
      });

      expect(await repository.findDefault({ kind: "user", userId, organizationId: faker.string.uuid() })).toBeUndefined();
    });

    it("returns the default of an organization whoever created it", async () => {
      const { repository } = await setup();
      const organizationId = faker.string.uuid();
      const channel = channelInput({ organizationId });

      await repository.createDefaultChannel(channel, { kind: "organization", organizationId });

      expect(await repository.findDefault({ kind: "organization", organizationId })).toEqual({ ...channel, isDefault: true });
    });

    it("returns undefined if no default notification channel exists for the user", async () => {
      const { repository } = await setup();

      expect(await repository.findDefault({ kind: "user", userId: faker.string.uuid(), organizationId: null })).toBeUndefined();
    });

    it("returns undefined if there is a soft deleted default notification channel", async () => {
      const { repository } = await setup();
      const userId = faker.string.uuid();
      const owner: DefaultChannelOwner = { kind: "user", userId, organizationId: null };
      const channel = channelInput({ userId });

      await repository.createDefaultChannel(channel, owner);
      await repository.deleteSafelyById(channel.id!);

      expect(await repository.findDefault(owner)).toBeUndefined();
    });
  });

  function channelInput(input: { userId?: string; organizationId?: string }): NotificationChannelInput {
    const { isDefault, ...channel } = generateNotificationChannel({ ...input, organizationId: input.organizationId ?? null });
    return channel;
  }

  async function liveDefaultsOf(repository: NotificationChannelRepository, owner: { userId?: string; organizationId?: string }) {
    const { data } = await repository.paginate({ limit: 100, userId: owner.userId });
    return data.filter(channel => channel.isDefault && (!owner.organizationId || channel.organizationId === owner.organizationId));
  }

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

    return { module, repository: module.get(NotificationChannelRepository) };
  }
});
