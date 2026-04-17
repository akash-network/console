import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { UserRepository } from "./user.repository";

describe(UserRepository.name, () => {
  describe("markAsActive", () => {
    it("updates lastActiveAt when last active longer ago than throttle", async () => {
      const { userRepository, createTestUser } = setup();
      const user = await createTestUser({ lastActiveAt: hoursAgo(1) });

      await userRepository.markAsActive(user.id, { throttleTimeSeconds: 60 });

      const updated = await userRepository.findById(user.id);
      expect(new Date(updated!.lastActiveAt!).getTime()).toBeGreaterThan(new Date(user.lastActiveAt!).getTime());
    });

    it("does not update lastActiveAt when recently active", async () => {
      const { userRepository, createTestUser } = setup();
      const user = await createTestUser({ lastActiveAt: new Date() });

      const before = await userRepository.findById(user.id);

      await userRepository.markAsActive(user.id, { throttleTimeSeconds: 3600 });

      const after = await userRepository.findById(user.id);
      expect(after!.lastActiveAt).toEqual(before!.lastActiveAt);
    });

    it("updates lastActiveAt when it is null", async () => {
      const { userRepository, createTestUser } = setup();
      const user = await createTestUser({ lastActiveAt: null });

      await userRepository.markAsActive(user.id, { throttleTimeSeconds: 60 });

      const updated = await userRepository.findById(user.id);
      expect(updated!.lastActiveAt).not.toBeNull();
    });

    it("updates lastIp when provided", async () => {
      const { userRepository, createTestUser } = setup();
      const user = await createTestUser({ lastActiveAt: hoursAgo(1) });
      const ip = faker.internet.ip();

      await userRepository.markAsActive(user.id, { throttleTimeSeconds: 60, ip });

      const updated = await userRepository.findById(user.id);
      expect(updated!.lastIp).toBe(ip);
    });

    it("updates lastFingerprint when provided", async () => {
      const { userRepository, createTestUser } = setup();
      const user = await createTestUser({ lastActiveAt: hoursAgo(1) });
      const fingerprint = faker.string.alphanumeric(32);

      await userRepository.markAsActive(user.id, { throttleTimeSeconds: 60, fingerprint });

      const updated = await userRepository.findById(user.id);
      expect(updated!.lastFingerprint).toBe(fingerprint);
    });

    it("does not update lastIp when not provided", async () => {
      const { userRepository, createTestUser } = setup();
      const existingIp = faker.internet.ip();
      const user = await createTestUser({ lastActiveAt: hoursAgo(1), lastIp: existingIp });

      await userRepository.markAsActive(user.id, { throttleTimeSeconds: 60 });

      const updated = await userRepository.findById(user.id);
      expect(updated!.lastIp).toBe(existingIp);
    });
  });

  let cleanup: () => Promise<void>;
  afterEach(async () => {
    await cleanup?.();
  });

  function hoursAgo(hours: number): Date {
    const date = new Date();
    date.setHours(date.getHours() - hours);
    return date;
  }

  function setup() {
    const userRepository = container.resolve(UserRepository);
    const createdUserIds: string[] = [];

    cleanup = async () => {
      if (createdUserIds.length > 0) {
        await userRepository.deleteById(createdUserIds);
      }
    };

    async function createTestUser(overrides: { lastActiveAt?: Date | null; lastIp?: string } = {}) {
      const user = await userRepository.create({
        id: faker.string.uuid(),
        userId: faker.string.uuid(),
        username: `testuser_${Date.now()}_${faker.string.alphanumeric(6)}`,
        email: faker.internet.email(),
        emailVerified: faker.datatype.boolean(),
        subscribedToNewsletter: false,
        ...overrides
      });
      createdUserIds.push(user.id);
      return user;
    }

    return { userRepository, createTestUser };
  }
});
