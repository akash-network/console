import { faker } from "@faker-js/faker";
import { ConfigModule } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { register } from "@src/infrastructure/db/db.module";
import * as schema from "@src/modules/notifications/model-schemas";
import { NotificationChannelRepository } from "../notification-channel/notification-channel.repository";
import { PendingAddressRepository } from "./pending-address.repository";

import { generateNotificationChannel } from "@test/seeders/notification-channel.seeder";
import { untilAQueryWaitsOnALock } from "@test/services/lock-waits";
import { TestDatabaseService } from "@test/services/test-database.service";

describe(PendingAddressRepository.name, () => {
  const testDbService = new TestDatabaseService(expect.getState().testPath!);
  let testModule: TestingModule | undefined;

  beforeAll(async () => {
    await testDbService.setup();
  });

  afterEach(async () => {
    await testModule?.get(DRIZZLE_PROVIDER_TOKEN).session.client.end();
    await testModule?.close();
  });

  afterAll(async () => {
    await testDbService.teardown();
  });

  describe("upsert and findByChannelIds", () => {
    it("lists the pending addresses of the given channels, a re-added address once", async () => {
      const { repository, channelRepository, hashes } = await setup();
      const [first, second, other] = await Promise.all([seedChannel(channelRepository), seedChannel(channelRepository), seedChannel(channelRepository)]);

      await repository.upsert([
        { notificationChannelId: first.id, address: "a@example.com", tokenHash: hashes[1] },
        { notificationChannelId: second.id, address: "b@example.com", tokenHash: hashes[2] },
        { notificationChannelId: other.id, address: "c@example.com", tokenHash: hashes[3] }
      ]);
      await repository.upsert([{ notificationChannelId: first.id, address: "a@example.com", tokenHash: hashes[4] }]);

      expect(await repository.findByChannelIds([first.id, second.id])).toEqual([
        { notificationChannelId: first.id, address: "a@example.com" },
        { notificationChannelId: second.id, address: "b@example.com" }
      ]);
      expect(await repository.confirmByTokenHash(hashes[1])).toBe(false);
      expect(await repository.confirmByTokenHash(hashes[4])).toBe(true);
    });

    it("lists nothing for no channel", async () => {
      const { repository } = await setup();

      expect(await repository.findByChannelIds([])).toEqual([]);
    });
  });

  describe("confirmByTokenHash", () => {
    it("adds the address to its channel and forgets the token", async () => {
      const { repository, channelRepository, hashes } = await setup();
      const channel = await seedChannel(channelRepository, ["owner@example.com"]);
      await repository.upsert([{ notificationChannelId: channel.id, address: "teammate@example.com", tokenHash: hashes[1] }]);

      const confirmed = await repository.confirmByTokenHash(hashes[1]);

      expect(confirmed).toBe(true);
      expect((await channelRepository.findById(channel.id))?.config.addresses).toEqual(["owner@example.com", "teammate@example.com"]);
      expect(await repository.findByChannelIds([channel.id])).toEqual([]);
      expect(await repository.confirmByTokenHash(hashes[1])).toBe(false);
    });

    it("leaves the addresses alone when the channel already has the address in another case", async () => {
      const { repository, channelRepository, hashes } = await setup();
      const channel = await seedChannel(channelRepository, ["Teammate@Example.com"]);
      await repository.upsert([{ notificationChannelId: channel.id, address: "teammate@example.com", tokenHash: hashes[1] }]);

      await repository.confirmByTokenHash(hashes[1]);

      expect((await channelRepository.findById(channel.id))?.config.addresses).toEqual(["Teammate@Example.com"]);
    });

    it("confirms nothing on a deleted channel", async () => {
      const { repository, channelRepository, hashes } = await setup();
      const channel = await seedChannel(channelRepository);
      await repository.upsert([{ notificationChannelId: channel.id, address: "teammate@example.com", tokenHash: hashes[1] }]);
      await channelRepository.deleteSafelyById(channel.id);

      expect(await repository.confirmByTokenHash(hashes[1])).toBe(false);
    });
  });

  describe("confirming while the channel's addresses are being changed", () => {
    it("waits for the change and adds the address to the addresses it leaves", async () => {
      const { repository, channelRepository, hashes, db } = await setup();
      const channel = await seedChannel(channelRepository, ["owner@example.com"]);
      await repository.upsert([{ notificationChannelId: channel.id, address: "teammate@example.com", tokenHash: hashes[0] }]);
      let confirmation: Promise<boolean> | undefined;

      await channelRepository.updateLocked(channel.id, async (_, tx) => {
        confirmation = repository.confirmByTokenHash(hashes[0]);
        await untilAQueryWaitsOnALock(db);
        await channelRepository.updateById(channel.id, { config: { addresses: ["ops@example.com"] } }, tx);
      });

      expect(await confirmation).toBe(true);
      expect((await channelRepository.findById(channel.id))?.config.addresses).toEqual(["ops@example.com", "teammate@example.com"]);
      expect(await repository.findByChannelIds([channel.id])).toEqual([]);
    });

    it("confirms nothing when the change drops the address it waited on", async () => {
      const { repository, channelRepository, hashes, db } = await setup();
      const channel = await seedChannel(channelRepository, ["owner@example.com"]);
      await repository.upsert([{ notificationChannelId: channel.id, address: "teammate@example.com", tokenHash: hashes[0] }]);
      let confirmation: Promise<boolean> | undefined;

      await channelRepository.updateLocked(channel.id, async (_, tx) => {
        confirmation = repository.confirmByTokenHash(hashes[0]);
        await untilAQueryWaitsOnALock(db);
        await repository.deleteFromChannel(channel.id, ["teammate@example.com"], tx);
      });

      expect(await confirmation).toBe(false);
      expect((await channelRepository.findById(channel.id))?.config.addresses).toEqual(["owner@example.com"]);
    });

    it("waits for the change before confirming a verified email on the user's channels", async () => {
      const { repository, channelRepository, hashes, db } = await setup();
      const userId = faker.string.uuid();
      const channel = await seedChannel(channelRepository, ["ops@example.com"], userId);
      await repository.upsert([{ notificationChannelId: channel.id, address: "owner@example.com", tokenHash: hashes[0] }]);
      let confirmation: Promise<number> | undefined;

      await channelRepository.updateLocked(channel.id, async (_, tx) => {
        confirmation = repository.confirmOnChannelsOf(userId, "owner@example.com");
        await untilAQueryWaitsOnALock(db);
        await channelRepository.updateById(channel.id, { config: { addresses: ["oncall@example.com"] } }, tx);
      });

      expect(await confirmation).toBe(1);
      expect((await channelRepository.findById(channel.id))?.config.addresses).toEqual(["oncall@example.com", "owner@example.com"]);
    });
  });

  describe("replaceToken", () => {
    it("replaces the token of a pending address only", async () => {
      const { repository, channelRepository, hashes } = await setup();
      const channel = await seedChannel(channelRepository);
      await repository.upsert([{ notificationChannelId: channel.id, address: "teammate@example.com", tokenHash: hashes[1] }]);

      const replaced = await repository.replaceToken({ notificationChannelId: channel.id, address: "teammate@example.com", tokenHash: hashes[2] });
      const missing = await repository.replaceToken({ notificationChannelId: channel.id, address: "other@example.com", tokenHash: hashes[3] });

      expect([replaced, missing]).toEqual([true, false]);
      expect(await repository.confirmByTokenHash(hashes[1])).toBe(false);
      expect(await repository.confirmByTokenHash(hashes[2])).toBe(true);
    });
  });

  describe("deleteFromChannel", () => {
    it("drops the given addresses of the channel only", async () => {
      const { repository, channelRepository, hashes } = await setup();
      const [channel, other] = await Promise.all([seedChannel(channelRepository), seedChannel(channelRepository)]);
      await repository.upsert([
        { notificationChannelId: channel.id, address: "a@example.com", tokenHash: hashes[1] },
        { notificationChannelId: channel.id, address: "b@example.com", tokenHash: hashes[2] },
        { notificationChannelId: other.id, address: "a@example.com", tokenHash: hashes[3] }
      ]);

      await repository.deleteFromChannel(channel.id, ["a@example.com"]);
      await repository.deleteFromChannel(channel.id, []);

      expect(await repository.findByChannelIds([channel.id, other.id])).toEqual([
        { notificationChannelId: other.id, address: "a@example.com" },
        { notificationChannelId: channel.id, address: "b@example.com" }
      ]);
    });
  });

  describe("confirmOnChannelsOf", () => {
    it("confirms the address on the user's live channels and leaves other users' channels waiting", async () => {
      const { repository, channelRepository, hashes } = await setup();
      const userId = faker.string.uuid();
      const [own, deleted, others] = await Promise.all([
        seedChannel(channelRepository, [], userId),
        seedChannel(channelRepository, [], userId),
        seedChannel(channelRepository, [])
      ]);
      await channelRepository.deleteSafelyById(deleted.id);
      await repository.upsert(
        [own, deleted, others].map((channel, index) => ({ notificationChannelId: channel.id, address: "owner@example.com", tokenHash: hashes[index] }))
      );

      const confirmed = await repository.confirmOnChannelsOf(userId, "owner@example.com");

      expect(confirmed).toBe(1);
      expect((await channelRepository.findById(own.id))?.config.addresses).toEqual(["owner@example.com"]);
      expect(await repository.findByChannelIds([own.id, deleted.id, others.id])).toEqual([
        { notificationChannelId: deleted.id, address: "owner@example.com" },
        { notificationChannelId: others.id, address: "owner@example.com" }
      ]);
    });
  });

  describe("countConfirmationEmailsSince", () => {
    it("counts the emails sent by a user or to an address after the given time", async () => {
      const { repository } = await setup();
      const userId = faker.string.uuid();
      const address = faker.internet.email().toLowerCase();
      const before = new Date(Date.now() - 60_000);

      await repository.recordConfirmationEmail(userId, address);
      await repository.recordConfirmationEmail(userId, faker.internet.email().toLowerCase());
      await repository.recordConfirmationEmail(faker.string.uuid(), address);

      expect(await repository.countConfirmationEmailsSince({ userId }, before)).toBe(2);
      expect(await repository.countConfirmationEmailsSince({ address }, before)).toBe(2);
      expect(await repository.countConfirmationEmailsSince({ userId }, new Date(Date.now() + 60_000))).toBe(0);
    });
  });

  async function setup() {
    testModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), ...register(schema)],
      providers: [PendingAddressRepository, NotificationChannelRepository]
    }).compile();

    return {
      repository: testModule.get(PendingAddressRepository),
      channelRepository: testModule.get(NotificationChannelRepository),
      db: testModule.get<NodePgDatabase<typeof schema>>(DRIZZLE_PROVIDER_TOKEN),
      hashes: Array.from({ length: 5 }, () => faker.string.hexadecimal({ length: 64, prefix: "" }))
    };
  }
});

async function seedChannel(channelRepository: NotificationChannelRepository, addresses: string[] = [], userId: string = faker.string.uuid()) {
  const { isDefault, ...channel } = generateNotificationChannel({ userId, config: { addresses } });

  return await channelRepository.create({ ...channel, isDefault: false });
}
