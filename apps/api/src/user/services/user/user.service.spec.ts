import "@test/setup-functional-tests"; // eslint-disable-line simple-import-sort/imports

import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";
import { container } from "tsyringe";

import type { LoggerService } from "@src/core/providers/logging.provider";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import type { RegisterUserInput } from "./user.service";
import { UserService } from "./user.service";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import type { GetUsers200ResponseOneOfInner } from "auth0";

describe(UserService.name, () => {
  describe("registerUser", () => {
    it("registers a new user", async () => {
      const createDefaultNotificationChannel = jest.fn(() => Promise.resolve());
      const { service, analyticsService, logger } = setup({ createDefaultNotificationChannel });

      const input: RegisterUserInput = {
        userId: faker.string.uuid(),
        wantedUsername: `test-user-${Date.now()}`,
        email: faker.internet.email(),
        emailVerified: faker.datatype.boolean(),
        subscribedToNewsletter: faker.datatype.boolean(),
        ip: faker.internet.ipv4(),
        userAgent: faker.string.alphanumeric(32),
        fingerprint: faker.string.alphanumeric(16)
      };
      const user = await service.registerUser(input);

      expect(user).toMatchObject({
        id: expect.any(String),
        userId: input.userId,
        email: input.email,
        emailVerified: input.emailVerified,
        subscribedToNewsletter: input.subscribedToNewsletter,
        username: input.wantedUsername
      });

      expect(analyticsService.identify).toHaveBeenCalledWith(user.id, {
        username: user.username,
        email: user.email
      });
      expect(logger.info).toHaveBeenCalledWith({ event: "USER_REGISTERED", id: user.id, userId: user.userId });
      expect(createDefaultNotificationChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: user.id,
          email: user.email
        })
      );
    });

    it("resolves username collision by adjusting username", async () => {
      const { service } = setup();

      const conflictingUsername = "conflictuser";

      const existingUser = await container.resolve(UserRepository).create({
        userId: faker.string.uuid(),
        username: conflictingUsername,
        emailVerified: false,
        subscribedToNewsletter: false
      });
      const input: RegisterUserInput = {
        userId: faker.string.uuid(),
        wantedUsername: conflictingUsername,
        email: faker.internet.email(),
        emailVerified: faker.datatype.boolean(),
        subscribedToNewsletter: faker.datatype.boolean(),
        ip: faker.internet.ipv4(),
        userAgent: faker.string.alphanumeric(32),
        fingerprint: faker.string.alphanumeric(16)
      };
      const newUsers = await Promise.all([
        service.registerUser({ ...input, email: faker.internet.email(), userId: faker.string.uuid() }),
        service.registerUser({ ...input, email: faker.internet.email(), userId: faker.string.uuid() })
      ]);

      expect(newUsers.map(u => u.id)).not.toContain(existingUser.id);
      expect(newUsers[0].username).not.toBe(existingUser.username);
      expect(newUsers[0].username).toMatch(new RegExp(`^${conflictingUsername}`));
      expect(newUsers[1].username).not.toBe(existingUser.username);
      expect(newUsers[1].username).toMatch(new RegExp(`^${conflictingUsername}`));
    });

    it("updates user if registering existing user", async () => {
      const { service } = setup();

      const existingUser = await container.resolve(UserRepository).create({
        userId: faker.string.uuid(),
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });

      const input: RegisterUserInput = {
        userId: existingUser.userId!,
        wantedUsername: faker.internet.userName(),
        email: `new_email_${existingUser.email}`,
        emailVerified: true,
        subscribedToNewsletter: true,
        ip: faker.internet.ipv4(),
        userAgent: faker.string.alphanumeric(32),
        fingerprint: faker.string.alphanumeric(16)
      };

      const newUser = await service.registerUser(input);

      expect(newUser).toMatchObject({
        id: existingUser.id,
        userId: existingUser.userId!,
        username: input.wantedUsername,
        email: input.email,
        emailVerified: input.emailVerified,
        subscribedToNewsletter: input.subscribedToNewsletter
      });
    });

    it("logs an error if createDefaultNotificationChannel returns an error", async () => {
      const input: RegisterUserInput = {
        userId: faker.string.uuid(),
        wantedUsername: `test-user-${Date.now()}`,
        email: faker.internet.email(),
        emailVerified: faker.datatype.boolean(),
        subscribedToNewsletter: faker.datatype.boolean(),
        ip: faker.internet.ipv4(),
        userAgent: faker.string.alphanumeric(32),
        fingerprint: faker.string.alphanumeric(16)
      };

      const error = new Error("test");
      const { service, logger } = setup({
        createDefaultNotificationChannel: () => Promise.reject(error)
      });

      const user = await service.registerUser(input);

      expect(user.id).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith({
        event: "FAILED_TO_CREATE_DEFAULT_NOTIFICATION_CHANNEL",
        id: user.id,
        error
      });
    });
  });

  describe("syncEmailVerified", () => {
    it("syncs `emailVerified` from auth0", async () => {
      const { service, auth0Service } = setup();

      const email = faker.internet.email();
      await container.resolve(UserRepository).create({
        email,
        emailVerified: false
      });

      auth0Service.getUserByEmail.mockResolvedValue({
        email_verified: true
      } as GetUsers200ResponseOneOfInner);

      const user = await service.syncEmailVerified({ email });
      expect(user).toMatchObject({
        emailVerified: true
      });

      auth0Service.getUserByEmail.mockResolvedValue({
        email_verified: false
      } as GetUsers200ResponseOneOfInner);
      const sameUser = await service.syncEmailVerified({ email });
      expect(sameUser).toMatchObject({
        emailVerified: false
      });
    });

    it("throws 404 when user is not found", async () => {
      const { service, auth0Service } = setup();

      const email = faker.internet.email();
      auth0Service.getUserByEmail.mockResolvedValue(null);
      await expect(service.syncEmailVerified({ email })).rejects.toThrow(/Not found/i);
    });

    it("throws 404 when user is not found in db", async () => {
      const { service, auth0Service } = setup();

      const email = faker.internet.email();
      auth0Service.getUserByEmail.mockResolvedValue({
        email_verified: true
      } as GetUsers200ResponseOneOfInner);
      await expect(service.syncEmailVerified({ email })).rejects.toThrow(/Not found/i);
    });
  });

  describe("getUserByUsername", () => {
    it("returns user with username and bio", async () => {
      const { service, userRepository } = setup();

      const user = await userRepository.create({
        userId: faker.string.uuid(),
        username: `test-user-${Date.now()}`,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false,
        bio: "Test bio"
      });

      const result = await service.getUserByUsername(user.username!);

      expect(result).toEqual({
        username: user.username,
        bio: user.bio
      });
    });

    it("returns null when user is not found", async () => {
      const { service } = setup();

      const result = await service.getUserByUsername("nonexistent-user");

      expect(result).toBeNull();
    });
  });

  describe("updateUserDetails", () => {
    it("updates user details", async () => {
      const { service, userRepository } = setup();

      const user = await userRepository.create({
        userId: faker.string.uuid(),
        username: `test-user-${Date.now()}`,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });

      const newBio = "Updated bio";
      const newYoutubeUsername = "youtube_user";

      await service.updateUserDetails(user.id, {
        bio: newBio,
        youtubeUsername: newYoutubeUsername
      });

      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser).toMatchObject({
        bio: newBio,
        youtubeUsername: newYoutubeUsername
      });
    });

    it("updates username when new username is provided", async () => {
      const { service, userRepository } = setup();

      const user = await userRepository.create({
        userId: faker.string.uuid(),
        username: `test-user-${Date.now()}`,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });

      const newUsername = `new-username-${Date.now()}`;

      await service.updateUserDetails(user.id, { username: newUsername });

      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser?.username).toBe(newUsername);
    });

    it("throws 404 when user is not found", async () => {
      const { service } = setup();

      await expect(service.updateUserDetails(faker.string.uuid(), { bio: "test" })).rejects.toThrow(/Not found/i);
    });

    it("throws 422 when username is already taken", async () => {
      const { service, userRepository } = setup();

      const existingUsername = `existing-user-${Date.now()}`;
      await userRepository.create({
        userId: faker.string.uuid(),
        username: existingUsername,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });

      const user = await userRepository.create({
        userId: faker.string.uuid(),
        username: `another-user-${Date.now()}`,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });

      await expect(service.updateUserDetails(user.id, { username: existingUsername })).rejects.toThrow(/Username not available/i);
    });

    it("does not throw when username is unchanged", async () => {
      const { service, userRepository } = setup();

      const username = `test-user-${Date.now()}`;
      const user = await userRepository.create({
        userId: faker.string.uuid(),
        username,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });

      await expect(service.updateUserDetails(user.id, { username })).resolves.not.toThrow();
    });
  });

  describe("subscribeToNewsletter", () => {
    it("updates subscribedToNewsletter to true", async () => {
      const { service, userRepository } = setup();

      const user = await userRepository.create({
        userId: faker.string.uuid(),
        username: `test-user-${Date.now()}`,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });

      await service.subscribeToNewsletter(user.id);

      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser?.subscribedToNewsletter).toBe(true);
    });
  });

  function setup(input?: { createDefaultNotificationChannel?: NotificationService["createDefaultChannel"] }) {
    const analyticsService = mock<AnalyticsService>();
    const logger = mock<LoggerService>();
    const auth0Service = mock<Auth0Service>();
    const userRepository = container.resolve(UserRepository);
    const service = new UserService(
      userRepository,
      analyticsService,
      logger,
      mock<NotificationService>({
        createDefaultChannel: input?.createDefaultNotificationChannel ?? (() => Promise.resolve())
      }),
      auth0Service
    );

    return { service, analyticsService, logger, auth0Service, userRepository };
  }
});
