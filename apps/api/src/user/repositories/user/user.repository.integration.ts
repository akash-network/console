import { faker } from "@faker-js/faker";
import subDays from "date-fns/subDays";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { UserWalletRepository } from "@src/billing/repositories";
import { UserRepository } from "./user.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

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

  describe("upsertOnExternalIdConflict", () => {
    it("returns wasInserted true when the external user id is new", async () => {
      const { userRepository, trackForCleanup } = setup();

      const { user, wasInserted } = await userRepository.upsertOnExternalIdConflict(newUserInput());
      trackForCleanup(user.id);

      expect(wasInserted).toBe(true);
    });

    it("returns wasInserted false when the external user id already exists", async () => {
      const { userRepository, trackForCleanup } = setup();
      const input = newUserInput();

      const first = await userRepository.upsertOnExternalIdConflict(input);
      trackForCleanup(first.user.id);

      const second = await userRepository.upsertOnExternalIdConflict({ ...input, email: faker.internet.email() });

      expect(first.wasInserted).toBe(true);
      expect(second.wasInserted).toBe(false);
      expect(second.user.id).toBe(first.user.id);
    });
  });

  describe("findTrialUsersByFingerprint", () => {
    it("matches only users whose trial wallet is activated", async () => {
      const { userRepository, createTestUser } = setup();
      const userWalletRepository = container.resolve(UserWalletRepository);
      const fingerprint = faker.string.alphanumeric(24);

      const activatedTrialUser = await createTestUser({ lastFingerprint: fingerprint });
      const activatedWallet = await userWalletRepository.create({ userId: activatedTrialUser.id, address: createAkashAddress() });
      await userWalletRepository.claimActivation(activatedWallet.id);

      const registeredOnlyUser = await createTestUser({ lastFingerprint: fingerprint });
      await userWalletRepository.create({ userId: registeredOnlyUser.id, address: createAkashAddress() });

      const currentUser = await createTestUser({ lastFingerprint: fingerprint });

      const matches = await userRepository.findTrialUsersByFingerprint(fingerprint, currentUser.id);

      expect(matches).toEqual([{ id: activatedTrialUser.id }]);
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

  function newUserInput() {
    return {
      userId: faker.string.uuid(),
      username: `testuser_${Date.now()}_${faker.string.alphanumeric(6)}`,
      email: faker.internet.email(),
      emailVerified: false,
      subscribedToNewsletter: false
    };
  }

  describe("hasEstablishedUserWithEmailDomain", () => {
    it("answers true for a domain with an account older than the window", async () => {
      const { userRepository, domain, createUserOnDomain } = setupDomain();
      await createUserOnDomain({ createdAt: subDays(new Date(), 45) });

      await expect(userRepository.hasEstablishedUserWithEmailDomain(domain, 30)).resolves.toBe(true);
    });

    it("answers false when every account on the domain is newer than the window", async () => {
      const { userRepository, domain, createUserOnDomain } = setupDomain();
      await createUserOnDomain({ createdAt: subDays(new Date(), 5) });

      await expect(userRepository.hasEstablishedUserWithEmailDomain(domain, 30)).resolves.toBe(false);
    });

    it("matches the domain part only, never a domain that merely contains it", async () => {
      const { userRepository, domain, createUserOnDomain } = setupDomain();
      await createUserOnDomain({ createdAt: subDays(new Date(), 45) }, `x${domain}`);
      await createUserOnDomain({ createdAt: subDays(new Date(), 45) }, `${domain}.attacker.net`);
      await createUserOnDomain({ createdAt: subDays(new Date(), 45) }, `mail.${domain}`);

      await expect(userRepository.hasEstablishedUserWithEmailDomain(domain, 30)).resolves.toBe(false);
    });

    it("matches a stored address whatever its case", async () => {
      const { userRepository, domain, createUserOnDomain } = setupDomain();
      await createUserOnDomain({ createdAt: subDays(new Date(), 45) }, domain.toUpperCase());

      await expect(userRepository.hasEstablishedUserWithEmailDomain(domain, 30)).resolves.toBe(true);
    });
  });

  function setupDomain() {
    const userRepository = container.resolve(UserRepository);
    const domain = `${faker.string.alphanumeric(16).toLowerCase()}.com`;

    async function createUserOnDomain(overrides: { createdAt: Date }, onDomain = domain) {
      return await userRepository.create({
        userId: faker.string.uuid(),
        email: `${faker.string.alphanumeric(10)}@${onDomain}`,
        ...overrides
      });
    }

    return { userRepository, domain, createUserOnDomain };
  }

  function setup() {
    const userRepository = container.resolve(UserRepository);
    const createdUserIds: string[] = [];

    cleanup = async () => {
      if (createdUserIds.length > 0) {
        await userRepository.deleteById(createdUserIds);
      }
    };

    async function createTestUser(overrides: { lastActiveAt?: Date | null; lastIp?: string; lastFingerprint?: string } = {}) {
      const user = await userRepository.create({
        id: faker.string.uuid(),
        ...newUserInput(),
        emailVerified: faker.datatype.boolean(),
        ...overrides
      });
      createdUserIds.push(user.id);
      return user;
    }

    return {
      userRepository,
      createTestUser,
      trackForCleanup: (id: string) => {
        createdUserIds.push(id);
      }
    };
  }
});
