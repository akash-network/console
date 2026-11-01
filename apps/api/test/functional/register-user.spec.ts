import { faker } from "@faker-js/faker";
import type { GetUsers200ResponseOneOfInner } from "auth0";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { personalOrganizationSlug } from "@src/organization/lib/personal-organization/personal-organization";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";

import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

interface RegisteredUserBody {
  data: { id: string; username: string; email: string; emailVerified: boolean };
  isNewUser: boolean;
}

describe("User registration", () => {
  const organizationRepository = container.resolve(OrganizationRepository);
  const organizationMemberRepository = container.resolve(OrganizationMemberRepository);
  const projectRepository = container.resolve(ProjectRepository);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
  const userRepository = container.resolve(UserRepository);
  const blockedEmailDomainRepository = container.resolve(BlockedEmailDomainRepository);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("POST /v1/register-user", () => {
    it("gives a new user a personal organization they own, a default project and files their wallet into it", async () => {
      const { register, wantedUsername } = setup();

      const response = await register();
      const body = (await response.json()) as RegisteredUserBody;

      expect(response.status).toBe(200);
      expect(body.isNewUser).toBe(true);
      const organization = await organizationRepository.findPersonalByUserId(body.data.id);
      expect(organization).toMatchObject({
        type: "personal",
        name: wantedUsername,
        slug: personalOrganizationSlug(body.data.id),
        createdByUserId: body.data.id
      });
      expect(await organizationMemberRepository.find({ userId: body.data.id })).toEqual([
        expect.objectContaining({ organizationId: organization?.id, role: "owner" })
      ]);
      expect(await projectRepository.find({ organizationId: organization?.id })).toEqual([
        expect.objectContaining({ name: "default-project", slug: "default-project", isDefault: true })
      ]);
      expect(await userWalletRepository.findOneByUserId(body.data.id)).toMatchObject({ organizationId: organization?.id });
    });

    it("stores the address Auth0 holds for the caller and its verification, whatever the request sends", async () => {
      const auth0Email = faker.internet.email().toLowerCase();
      const { register } = setup({ auth0User: { email: auth0Email, emailVerified: false } });

      const response = await register({ email: faker.internet.email().toLowerCase(), emailVerified: true });
      const body = (await response.json()) as RegisteredUserBody;

      expect(response.status).toBe(200);
      expect(body.data).toMatchObject({ email: auth0Email, emailVerified: false });
      expect(await userRepository.findById(body.data.id)).toMatchObject({ email: auth0Email, emailVerified: false });
    });

    it("refuses a new account when the address Auth0 holds for the caller is on a blocked domain", async () => {
      const blockedDomain = `${faker.string.alphanumeric(16).toLowerCase()}.com`;
      await blockedEmailDomainRepository.create({ domain: blockedDomain, status: "blocked", source: "manual" });
      const { register, externalUserId } = setup({ auth0User: { email: `someone@${blockedDomain}`, emailVerified: true } });
      vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => flag === FeatureFlags.BLOCKED_EMAIL_DOMAIN_ENFORCEMENT);

      const response = await register({ email: faker.internet.email().toLowerCase() });

      expect(response.status).toBe(403);
      expect(await userRepository.findByUserId(externalUserId)).toBeUndefined();
    });

    it("creates nothing new when the same user registers again", async () => {
      const { register } = setup();
      const first = (await (await register()).json()) as RegisteredUserBody;

      const response = await register();
      const second = (await response.json()) as RegisteredUserBody;

      expect(response.status).toBe(200);
      expect(second).toMatchObject({ isNewUser: false, data: { id: first.data.id } });
      const organization = await organizationRepository.findPersonalByUserId(first.data.id);
      expect(await organizationRepository.count({ createdByUserId: first.data.id })).toBe(1);
      expect(await organizationMemberRepository.count({ userId: first.data.id })).toBe(1);
      expect(await projectRepository.count({ organizationId: organization?.id })).toBe(1);
    });

    it("creates one personal organization when the same new user registers twice at once", async () => {
      const { register } = setup();

      const responses = await Promise.all([register(), register()]);
      const bodies = (await Promise.all(responses.map(response => response.json()))) as RegisteredUserBody[];

      expect(responses.map(response => response.status)).toEqual([200, 200]);
      expect(new Set(bodies.map(body => body.data.id)).size).toBe(1);
      const organization = await organizationRepository.findPersonalByUserId(bodies[0].data.id);
      expect(await organizationRepository.count({ createdByUserId: bodies[0].data.id })).toBe(1);
      expect(await organizationMemberRepository.count({ userId: bodies[0].data.id })).toBe(1);
      expect(await projectRepository.count({ organizationId: organization?.id })).toBe(1);
    });

    it("files the rows of an account that predates organizations into its new personal organization", async () => {
      const { user, wallet } = await seedUserWithWallet({ user: { userId: faker.string.uuid(), username: `user-${faker.string.alphanumeric(12)}` } });
      const deployment = await seedDeploymentSetting({ userId: user.id });
      const { register } = setup({ externalUserId: user.userId as string });

      const response = await register();

      expect(response.status).toBe(200);
      const organization = await organizationRepository.findPersonalByUserId(user.id);
      const project = await projectRepository.findDefaultByOrganizationId(organization?.id as string);
      expect(organization).toMatchObject({ type: "personal", createdByUserId: user.id });
      expect(await userWalletRepository.findById(wallet.id)).toMatchObject({ organizationId: organization?.id });
      expect(await deploymentSettingRepository.findById(deployment.id)).toMatchObject({ organizationId: organization?.id, projectId: project?.id });
    });
  });

  function setup(input: { externalUserId?: string; auth0User?: { email: string; emailVerified: boolean } } = {}) {
    const externalUserId = input.externalUserId ?? faker.string.uuid();
    const token = faker.string.alphanumeric(40);
    const wantedUsername = `user-${faker.string.alphanumeric(12)}`;
    const auth0User = input.auth0User ?? { email: faker.internet.email().toLowerCase(), emailVerified: true };

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? externalUserId : null
    );
    vi.spyOn(container.resolve(Auth0Service), "getUser").mockImplementation(async userId =>
      userId === externalUserId
        ? mock<GetUsers200ResponseOneOfInner>({ user_id: userId, email: auth0User.email, email_verified: auth0User.emailVerified })
        : null
    );
    vi.spyOn(container.resolve(NotificationService), "createDefaultChannel").mockResolvedValue(undefined);
    vi.spyOn(container.resolve(NotificationService), "createNotification").mockResolvedValue(undefined);

    const register = (body: { email?: string; emailVerified?: boolean } = {}) =>
      app.request("/v1/register-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ wantedUsername, email: auth0User.email, emailVerified: auth0User.emailVerified, subscribedToNewsletter: false, ...body })
      });

    return { externalUserId, wantedUsername, register };
  }
});
