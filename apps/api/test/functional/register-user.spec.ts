import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { personalOrganizationSlug } from "@src/organization/lib/personal-organization/personal-organization";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { app } from "@src/rest-app";

import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

interface RegisteredUserBody {
  data: { id: string; username: string };
  isNewUser: boolean;
}

describe("User registration", () => {
  const organizationRepository = container.resolve(OrganizationRepository);
  const organizationMemberRepository = container.resolve(OrganizationMemberRepository);
  const projectRepository = container.resolve(ProjectRepository);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);

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
      expect(await projectRepository.find({ organizationId: organization?.id })).toEqual([expect.objectContaining({ slug: "default", isDefault: true })]);
      expect(await userWalletRepository.findOneByUserId(body.data.id)).toMatchObject({ organizationId: organization?.id });
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

  function setup(input: { externalUserId?: string } = {}) {
    const externalUserId = input.externalUserId ?? faker.string.uuid();
    const token = faker.string.alphanumeric(40);
    const wantedUsername = `user-${faker.string.alphanumeric(12)}`;
    const email = faker.internet.email().toLowerCase();

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? externalUserId : null
    );
    vi.spyOn(container.resolve(NotificationService), "createDefaultChannel").mockResolvedValue(undefined);

    const register = () =>
      app.request("/v1/register-user", {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ wantedUsername, email, emailVerified: true, subscribedToNewsletter: false })
      });

    return { externalUserId, wantedUsername, register };
  }
});
