import { faker } from "@faker-js/faker";
import type { GetUsers200ResponseOneOfInner } from "auth0";
import { eq } from "drizzle-orm";
import { generateKeyPairSync } from "node:crypto";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import type { EmailVerificationCodeService } from "@src/auth/services/email-verification-code/email-verification-code.service";
import { VerifiedEmailService } from "@src/auth/services/verified-email/verified-email.service";
import type { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import type { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestClaimService } from "@src/hardware-request/services/hardware-request-claim/hardware-request-claim.service";
import type { NotificationService } from "@src/notifications/services/notification/notification.service";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { PersonalOrganizationService } from "@src/organization/services/personal-organization/personal-organization.service";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyService } from "@src/secret/services/data-key/data-key.service";
import { AccountStatusEventRepository } from "@src/user/repositories/account-status-event/account-status-event.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { AccountStatusService } from "@src/user/services/account-status/account-status.service";
import { ApplyAccountTerminationHandler } from "@src/user/services/apply-account-termination/apply-account-termination.handler";
import { ApplyAccountTermination, applyAccountTerminationKeyFor } from "@src/user/services/apply-account-termination/apply-account-termination.job";
import type { BlockedEmailDomainService } from "@src/workload-abuse/services/blocked-email-domain/blocked-email-domain.service";
import type { RegisterUserInput } from "./user.service";
import { UserService } from "./user.service";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { createAdoptedRowCounts } from "@test/seeders/organization.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";
import { findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(ApplyAccountTerminationHandler)]);

describe(UserService.name, () => {
  describe("registerUser", () => {
    it("gives the registered user a personal organization they own, with a default project", async () => {
      const { service, organizationRepository, organizationMemberRepository, projectRepository } = setup();

      const result = await service.registerUser(createRegisterInput());

      const organization = await organizationRepository.findPersonalByUserId(result.id);
      expect(organization).toMatchObject({ type: "personal", name: result.username, createdByUserId: result.id });
      expect(await organizationMemberRepository.findOneBy({ organizationId: organization?.id, userId: result.id })).toMatchObject({ role: "owner" });
      expect(await projectRepository.findDefaultByOrganizationId(organization?.id as string)).toMatchObject({
        name: "default-project",
        slug: "default-project",
        isDefault: true
      });
    });

    it("creates no user when the personal organization cannot be created", async () => {
      const { service, userRepository } = setup({ ensureForUser: vi.fn().mockRejectedValue(new Error("organizations are down")) });
      const input = createRegisterInput();

      await expect(service.registerUser(input)).rejects.toThrow("organizations are down");

      expect(await userRepository.findByUserId(input.userId)).toBeUndefined();
    });

    it("registers a new user", async () => {
      const createDefaultNotificationChannel = vi.fn(() => Promise.resolve());
      const signInEmail = { email: faker.internet.email(), emailVerified: faker.datatype.boolean() };
      const { service, analyticsService, logger } = setup({ createDefaultNotificationChannel, signInEmail });

      const input: RegisterUserInput = {
        userId: faker.string.uuid(),
        wantedUsername: `test-user-${Date.now()}`,
        subscribedToNewsletter: faker.datatype.boolean(),
        ip: faker.internet.ipv4(),
        userAgent: faker.string.alphanumeric(32),
        fingerprint: faker.string.alphanumeric(16)
      };
      const user = await service.registerUser(input);

      expect(user).toMatchObject({
        id: expect.any(String),
        userId: input.userId,
        email: signInEmail.email,
        emailVerified: signInEmail.emailVerified,
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

    it("creates a verified account terminated when a termination named its address verified, whatever its case", async () => {
      const domain = `${faker.string.alphanumeric(12).toLowerCase()}.com`;
      const terminated = await seedTermination({ email: `Jane@${domain}`, emailVerified: true });
      const { service, userRepository } = setup({ signInEmail: { email: `jane@${domain.toUpperCase()}`, emailVerified: true } });

      const registered = await service.registerUser(createRegisterInput());

      expect((await userRepository.findById(registered.id))?.accountStatus).toBe("terminated");
      expect(await findAccountStatusEventsOf(registered.id)).toEqual([
        expect.objectContaining({
          action: "terminate",
          userEmail: registered.email,
          actorStaffId: null,
          actorEmail: "system",
          actorName: "Console",
          userReason: "Repeated payment fraud",
          internalNote: null,
          options: { forfeitCredits: false, matchedUserId: terminated.id, emailVerified: true }
        })
      ]);
    });

    it("creates an unverified account active, then terminates it on the sign-in that finds its address verified, queueing the termination's effects", async () => {
      const email = faker.internet.email();
      await seedTermination({ email, emailVerified: true });
      const userId = faker.string.uuid();

      const registered = await setup({ signInEmail: { email, emailVerified: false } }).service.registerUser(createRegisterInput({ userId }));
      const { userRepository } = setup({});
      const statusWhileUnverified = (await userRepository.findById(registered.id))?.accountStatus;
      await setup({ signInEmail: { email, emailVerified: true } }).service.registerUser(createRegisterInput({ userId }));

      expect(statusWhileUnverified).toBe("active");
      expect((await userRepository.findById(registered.id))?.accountStatus).toBe("terminated");
      expect(await findJobRows(ApplyAccountTermination[JOB_NAME], { singletonKey: applyAccountTerminationKeyFor(registered.id) })).toEqual([
        expect.objectContaining({ state: "created", data: { userId: registered.id, forfeitCredits: false, version: 1 } })
      ]);
    });

    it("never carries over a termination of an address that was not verified when it was terminated", async () => {
      const email = faker.internet.email();
      await seedTermination({ email, emailVerified: false });
      const { service, userRepository } = setup({ signInEmail: { email, emailVerified: true } });

      const registered = await service.registerUser(createRegisterInput());

      expect((await userRepository.findById(registered.id))?.accountStatus).toBe("active");
      expect(await findAccountStatusEventsOf(registered.id)).toEqual([]);
    });

    it("creates an active account when the accounts with the same email are not terminated", async () => {
      const email = faker.internet.email();
      await container.resolve(UserRepository).create({ userId: faker.string.uuid(), email, emailVerified: true, accountStatus: "suspended" });
      const { service, userRepository } = setup({ signInEmail: { email, emailVerified: true } });

      const registered = await service.registerUser(createRegisterInput());

      expect((await userRepository.findById(registered.id))?.accountStatus).toBe("active");
      expect(await findAccountStatusEventsOf(registered.id)).toEqual([]);
    });

    it("signs a terminated account back in to itself, keeping the address it was terminated under", async () => {
      const terminated = await seedTermination({ email: faker.internet.email(), emailVerified: true });
      const { service, userRepository } = setup({ signInEmail: { email: faker.internet.email(), emailVerified: false } });

      const registered = await service.registerUser(createRegisterInput({ userId: terminated.userId! }));

      expect(registered).toMatchObject({ id: terminated.id, email: terminated.email, emailVerified: true });
      expect(await userRepository.findById(terminated.id)).toMatchObject({ accountStatus: "terminated", email: terminated.email, emailVerified: true });
      expect(await findAccountStatusEventsOf(terminated.id)).toHaveLength(1);
    });

    it("hands a verified sign-in the GPU requests the team filed for its email, in its personal organization", async () => {
      const email = faker.internet.email();
      const filedForThem = await seedHardwareRequest({ userId: null, contactEmail: email.toUpperCase() });
      const filedForSomeoneElse = await seedHardwareRequest({ userId: null, contactEmail: faker.internet.email() });
      const { service } = setup({ signInEmail: { email, emailVerified: true } });

      const user = await service.registerUser({
        userId: faker.string.uuid(),
        wantedUsername: `test-user-${Date.now()}`,
        subscribedToNewsletter: false,
        ip: faker.internet.ipv4(),
        userAgent: faker.string.alphanumeric(32),
        fingerprint: faker.string.alphanumeric(16)
      });

      const personalOrganization = await container.resolve(OrganizationRepository).findPersonalByUserId(user.id);
      const hardwareRequests = container.resolve(HardwareRequestRepository);
      expect(await hardwareRequests.findById(filedForThem.id)).toMatchObject({ userId: user.id, organizationId: personalOrganization?.id });
      expect(await hardwareRequests.findById(filedForSomeoneElse.id)).toMatchObject({ userId: null, organizationId: null });
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
        subscribedToNewsletter: faker.datatype.boolean(),
        ip: faker.internet.ipv4(),
        userAgent: faker.string.alphanumeric(32),
        fingerprint: faker.string.alphanumeric(16)
      };
      const newUsers = await Promise.all([
        service.registerUser({ ...input, userId: faker.string.uuid() }),
        service.registerUser({ ...input, userId: faker.string.uuid() })
      ]);

      expect(newUsers.map(u => u.id)).not.toContain(existingUser.id);
      expect(newUsers[0].username).not.toBe(existingUser.username);
      expect(newUsers[0].username).toMatch(new RegExp(`^${conflictingUsername}`));
      expect(newUsers[1].username).not.toBe(existingUser.username);
      expect(newUsers[1].username).toMatch(new RegExp(`^${conflictingUsername}`));
    });

    it("updates user if registering existing user", async () => {
      const existingUser = await container.resolve(UserRepository).create({
        userId: faker.string.uuid(),
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });
      const signInEmail = { email: `new_email_${existingUser.email}`, emailVerified: true };
      const { service } = setup({ signInEmail });

      const input: RegisterUserInput = {
        userId: existingUser.userId!,
        wantedUsername: faker.internet.userName(),
        subscribedToNewsletter: true,
        ip: faker.internet.ipv4(),
        userAgent: faker.string.alphanumeric(32),
        fingerprint: faker.string.alphanumeric(16)
      };

      const newUser = await service.registerUser(input);

      expect(newUser).toMatchObject({
        id: existingUser.id,
        userId: existingUser.userId!,
        ...signInEmail,
        subscribedToNewsletter: input.subscribedToNewsletter
      });
    });

    it("downgrades a stored verification Auth0 no longer reports for the user", async () => {
      const existingUser = await container.resolve(UserRepository).create({
        userId: faker.string.uuid(),
        email: faker.internet.email(),
        emailVerified: true
      });
      const { service, userRepository } = setup({ signInEmail: { email: existingUser.email!, emailVerified: false } });

      await service.registerUser(createRegisterInput({ userId: existingUser.userId! }));

      expect(await userRepository.findById(existingUser.id)).toMatchObject({ email: existingUser.email, emailVerified: false });
    });

    it("creates exactly one data key for the registered user", async () => {
      const { service, dataKeyRepository } = setup();

      const user = await service.registerUser(createRegisterInput());

      expect(await dataKeyRepository.count({ userId: user.id })).toBe(1);
      expect(await dataKeyRepository.findByUserId(user.id)).toMatchObject({ wrappedByKid: "sdl-secrets.v1", wrappedKey: expect.any(String) });
    });

    it("registers the user even when data key creation fails", async () => {
      const dataKeyError = new Error("sealing key unavailable");
      const { service, dataKeyRepository, logger } = setup({ ensureDataKey: () => Promise.reject(dataKeyError) });

      const user = await service.registerUser(createRegisterInput());

      expect(user.id).toBeDefined();
      expect(await dataKeyRepository.count({ userId: user.id })).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "FAILED_TO_ENSURE_USER_DATA_KEY", id: user.id, error: dataKeyError }));
    });

    it("logs an error if createDefaultNotificationChannel returns an error", async () => {
      const input: RegisterUserInput = {
        userId: faker.string.uuid(),
        wantedUsername: `test-user-${Date.now()}`,
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

  describe("getUserByUsername", () => {
    it("returns user with username and bio", async () => {
      const { service, userRepository } = setup();

      const user = await userRepository.create({
        userId: faker.string.uuid(),
        username: `test-user-${faker.string.uuid()}`,
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
        username: `test-user-${faker.string.uuid()}`,
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
        username: `test-user-${faker.string.uuid()}`,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });

      const newUsername = `new-username-${Date.now()}`;

      await service.updateUserDetails(user.id, { username: newUsername });

      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser?.username).toBe(newUsername);
    });

    it("renames the user's personal organization to the new username without touching anyone else's", async () => {
      const { service, organizationRepository } = setup();
      const user = await service.registerUser(createRegisterInput());
      const stranger = await service.registerUser(createRegisterInput());
      const newUsername = `renamed-${faker.string.alphanumeric(12)}`;

      await service.updateUserDetails(user.id, { username: newUsername });

      expect(await organizationRepository.findPersonalByUserId(user.id)).toMatchObject({ name: newUsername });
      expect(await organizationRepository.findPersonalByUserId(stranger.id)).toMatchObject({ name: stranger.username });
    });

    it("keeps the username when the personal organization cannot be renamed", async () => {
      const { service, userRepository } = setup({ renameToUsername: vi.fn().mockRejectedValue(new Error("organizations are down")) });
      const user = await userRepository.create({
        userId: faker.string.uuid(),
        username: `test-user-${faker.string.uuid()}`,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });

      await expect(service.updateUserDetails(user.id, { username: `renamed-${faker.string.alphanumeric(12)}` })).rejects.toThrow("organizations are down");

      expect(await userRepository.findById(user.id)).toMatchObject({ username: user.username });
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
        username: `test-user-${faker.string.uuid()}`,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });

      await service.subscribeToNewsletter(user.id);

      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser?.subscribedToNewsletter).toBe(true);
    });
  });

  describe("skipOnboarding", () => {
    it("sets onboardingSkippedAt when it has not been set", async () => {
      const { service, userRepository } = setup();
      const user = await userRepository.create({
        userId: faker.string.uuid(),
        username: `test-user-${faker.string.uuid()}`,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });

      await service.skipOnboarding(user.id);

      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser?.onboardingSkippedAt).toBeInstanceOf(Date);
    });

    it("preserves the original timestamp when called again", async () => {
      const { service, userRepository } = setup();
      const user = await userRepository.create({
        userId: faker.string.uuid(),
        username: `test-user-${faker.string.uuid()}`,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });

      await service.skipOnboarding(user.id);
      const firstSkippedAt = (await userRepository.findById(user.id))?.onboardingSkippedAt;

      await service.skipOnboarding(user.id);
      const secondSkippedAt = (await userRepository.findById(user.id))?.onboardingSkippedAt;

      expect(secondSkippedAt).toEqual(firstSkippedAt);
    });
  });

  describe("acceptFairUsePolicy", () => {
    it("sets fairUsePolicyAcceptedAt when it has not been set", async () => {
      const { service, userRepository } = setup();
      const user = await userRepository.create({
        userId: faker.string.uuid(),
        username: `test-user-${faker.string.uuid()}`,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });

      await service.acceptFairUsePolicy(user.id);

      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser?.fairUsePolicyAcceptedAt).toBeInstanceOf(Date);
    });

    it("preserves the original timestamp when called again", async () => {
      const { service, userRepository } = setup();
      const user = await userRepository.create({
        userId: faker.string.uuid(),
        username: `test-user-${faker.string.uuid()}`,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });

      await service.acceptFairUsePolicy(user.id);
      const firstAcceptedAt = (await userRepository.findById(user.id))?.fairUsePolicyAcceptedAt;

      await service.acceptFairUsePolicy(user.id);
      const secondAcceptedAt = (await userRepository.findById(user.id))?.fairUsePolicyAcceptedAt;

      expect(secondAcceptedAt).toEqual(firstAcceptedAt);
    });
  });

  describe("markGetStartedDismissed", () => {
    it("sets getStartedDismissedAt when it has not been set", async () => {
      const { service, userRepository } = setup();
      const user = await userRepository.create({ userId: faker.string.uuid(), username: `test-user-${faker.string.uuid()}` });

      await service.markGetStartedDismissed(user.id);

      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser?.getStartedDismissedAt).toBeInstanceOf(Date);
    });

    it("preserves the original timestamp when called again", async () => {
      const { service, userRepository } = setup();
      const user = await userRepository.create({ userId: faker.string.uuid(), username: `test-user-${faker.string.uuid()}` });

      await service.markGetStartedDismissed(user.id);
      const firstAt = (await userRepository.findById(user.id))?.getStartedDismissedAt;
      await service.markGetStartedDismissed(user.id);
      const secondAt = (await userRepository.findById(user.id))?.getStartedDismissedAt;

      expect(secondAt).toEqual(firstAt);
    });
  });

  describe("markAgentSetupCopied", () => {
    it("sets agentSetupCopiedAt when it has not been set", async () => {
      const { service, userRepository } = setup();
      const user = await userRepository.create({ userId: faker.string.uuid(), username: `test-user-${faker.string.uuid()}` });

      await service.markAgentSetupCopied(user.id);

      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser?.agentSetupCopiedAt).toBeInstanceOf(Date);
    });

    it("preserves the original timestamp when called again", async () => {
      const { service, userRepository } = setup();
      const user = await userRepository.create({ userId: faker.string.uuid(), username: `test-user-${faker.string.uuid()}` });

      await service.markAgentSetupCopied(user.id);
      const firstAt = (await userRepository.findById(user.id))?.agentSetupCopiedAt;
      await service.markAgentSetupCopied(user.id);
      const secondAt = (await userRepository.findById(user.id))?.agentSetupCopiedAt;

      expect(secondAt).toEqual(firstAt);
    });
  });

  describe("markGithubStarPrompted", () => {
    it("sets githubStarPromptedAt when it has not been set", async () => {
      const { service, userRepository } = setup();
      const user = await userRepository.create({ userId: faker.string.uuid(), username: `test-user-${faker.string.uuid()}` });

      await service.markGithubStarPrompted(user.id);

      const updatedUser = await userRepository.findById(user.id);
      expect(updatedUser?.githubStarPromptedAt).toBeInstanceOf(Date);
    });

    it("preserves the original timestamp when called again", async () => {
      const { service, userRepository } = setup();
      const user = await userRepository.create({ userId: faker.string.uuid(), username: `test-user-${faker.string.uuid()}` });

      await service.markGithubStarPrompted(user.id);
      const firstAt = (await userRepository.findById(user.id))?.githubStarPromptedAt;
      await service.markGithubStarPrompted(user.id);
      const secondAt = (await userRepository.findById(user.id))?.githubStarPromptedAt;

      expect(secondAt).toEqual(firstAt);
    });
  });

  function createRegisterInput(overrides: Partial<RegisterUserInput> = {}): RegisterUserInput {
    return {
      userId: faker.string.uuid(),
      wantedUsername: `test-user-${faker.string.uuid()}`,
      subscribedToNewsletter: faker.datatype.boolean(),
      ip: faker.internet.ipv4(),
      userAgent: faker.string.alphanumeric(32),
      fingerprint: faker.string.alphanumeric(16),
      ...overrides
    };
  }

  async function seedTermination(input: { email: string; emailVerified: boolean }) {
    await jobWorkers();
    const terminated = await container.resolve(UserRepository).create({
      userId: faker.string.uuid(),
      email: input.email,
      emailVerified: input.emailVerified,
      accountStatus: "terminated"
    });
    await container.resolve(AccountStatusEventRepository).create({
      userId: terminated.id,
      userEmail: terminated.email,
      action: "terminate",
      actorEmail: faker.internet.email(),
      actorName: faker.person.fullName(),
      userReason: "Repeated payment fraud",
      internalNote: "Chargebacks on three cards",
      options: { forfeitCredits: false, emailVerified: input.emailVerified }
    });

    return terminated;
  }

  function setup(input?: {
    createDefaultNotificationChannel?: NotificationService["createDefaultChannel"];
    ensureDataKey?: DataKeyService["ensureDataKey"];
    ensureForUser?: PersonalOrganizationService["ensureForUser"];
    renameToUsername?: PersonalOrganizationService["renameToUsername"];
    isBlockedEmail?: boolean;
    signInEmail?: { email: string; emailVerified: boolean };
  }) {
    const analyticsService = mock<AnalyticsService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = () => logger;
    const auth0Service = mock<Auth0Service>({
      getUser: vi.fn(async (userId: string) =>
        mock<GetUsers200ResponseOneOfInner>({
          user_id: userId,
          email: input?.signInEmail?.email ?? faker.internet.email(),
          email_verified: input?.signInEmail?.emailVerified ?? faker.datatype.boolean()
        })
      )
    });
    const walletInitializerService = mock<WalletInitializerService>({
      ensureWallet: vi.fn().mockResolvedValue(createUserWallet())
    });
    const userRepository = container.resolve(UserRepository);
    const dataKeyRepository = container.resolve(DataKeyRepository);
    const publicKey = generateKeyPairSync("rsa", { modulusLength: 3072 }).publicKey;
    const { n, e } = publicKey.export({ format: "jwk" });
    const sealingKeyService = mock<SdlSecretsSealingKeyService>();
    sealingKeyService.peekSealingKey.mockReturnValue({ kid: "sdl-secrets.v1", publicKey, jwk: { kty: "RSA", n: n!, e: e!, use: "enc", alg: "RSA-OAEP-256" } });
    const dataKeyService = new DataKeyService(dataKeyRepository, sealingKeyService, createLogger);
    const personalOrganizationService =
      input?.ensureForUser || input?.renameToUsername
        ? mock<PersonalOrganizationService>({
            ensureForUser: input.ensureForUser ?? vi.fn(),
            renameToUsername: input.renameToUsername ?? vi.fn(),
            adoptUserRows: vi.fn().mockResolvedValue(createAdoptedRowCounts())
          })
        : container.resolve(PersonalOrganizationService);
    const service = new UserService(
      userRepository,
      analyticsService,
      createLogger,
      mock<NotificationService>({
        createDefaultChannel: input?.createDefaultNotificationChannel ?? (() => Promise.resolve()),
        confirmAccountEmail: () => Promise.resolve()
      }),
      mock<EmailVerificationCodeService>({
        sendCode: vi.fn().mockResolvedValue({ codeSentAt: new Date().toISOString() })
      }),
      walletInitializerService,
      mock<TrialActivationJobService>({ schedule: vi.fn().mockResolvedValue(undefined) }),
      input?.ensureDataKey ? mock<DataKeyService>({ ensureDataKey: input.ensureDataKey }) : dataKeyService,
      mock<BlockedEmailDomainService>({ isBlockedEmail: vi.fn().mockResolvedValue(input?.isBlockedEmail ?? false) }),
      personalOrganizationService,
      container.resolve(TxService),
      new VerifiedEmailService(auth0Service),
      container.resolve(HardwareRequestClaimService),
      container.resolve(AccountStatusService)
    );

    return {
      service,
      analyticsService,
      logger,
      userRepository,
      walletInitializerService,
      dataKeyRepository,
      organizationRepository: container.resolve(OrganizationRepository),
      organizationMemberRepository: container.resolve(OrganizationMemberRepository),
      projectRepository: container.resolve(ProjectRepository)
    };
  }
});

async function findAccountStatusEventsOf(userId: string) {
  const events = resolveTable("AccountStatusEvents");
  return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(events).where(eq(events.userId, userId));
}
