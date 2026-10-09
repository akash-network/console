import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { personalOrganizationSlug } from "@src/organization/lib/personal-organization/personal-organization";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { UserOutput } from "@src/user/repositories/user/user.repository";
import { PersonalOrganizationService } from "./personal-organization.service";

import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganization, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { seedWalletSetting } from "@test/seeders/db/wallet-setting.seeder";

describe(PersonalOrganizationService.name, () => {
  describe("ensureForUser", () => {
    it("creates one organization, one owner membership and one default project when called concurrently for the same user", async () => {
      const { service, user, organizationRepository, organizationMemberRepository, projectRepository } = await setup();

      const organizations = await Promise.all(Array.from({ length: 5 }, () => service.ensureForUser(user)));

      expect(new Set(organizations.map(organization => organization.id)).size).toBe(1);
      expect(organizations[0]).toMatchObject({ type: "personal", createdByUserId: user.id, name: user.username, slug: personalOrganizationSlug(user.id) });
      expect(await organizationRepository.count({ createdByUserId: user.id })).toBe(1);
      expect(await organizationMemberRepository.find({ userId: user.id })).toEqual([
        expect.objectContaining({ organizationId: organizations[0].id, role: "owner" })
      ]);
      expect(await projectRepository.find({ organizationId: organizations[0].id })).toEqual([
        expect.objectContaining({ slug: "default", isDefault: true, createdByUserId: user.id })
      ]);
    });

    it("changes nothing when called again for a user who already has everything", async () => {
      const { service, user, organizationRepository, organizationMemberRepository, projectRepository } = await setup();

      const first = await service.ensureForUser(user);
      const second = await service.ensureForUser(user);

      expect(second).toEqual(first);
      expect(await organizationRepository.count({ createdByUserId: user.id })).toBe(1);
      expect(await organizationMemberRepository.count({ userId: user.id })).toBe(1);
      expect(await projectRepository.count({ organizationId: first.id })).toBe(1);
    });

    it("falls back to a numbered slug when the formulaic one is taken", async () => {
      const { service, user } = await setup();
      await seedOrganization({ slug: personalOrganizationSlug(user.id) });

      const organization = await service.ensureForUser(user);

      expect(organization.slug).toBe(personalOrganizationSlug(user.id, 1));
    });
  });

  describe("adoptUserRows", () => {
    it("files the user's rows into the organization, deployments and templates into its default project, without touching anyone else's", async () => {
      const { service, user, projectRepository, seedOwnedRows, readOrganizationIds } = await setup();
      const stranger = await setup();
      const rows = await seedOwnedRows(user);
      const strangerRows = await stranger.seedOwnedRows(stranger.user);
      const organization = await service.ensureForUser(user);
      const project = await projectRepository.findDefaultByOrganizationId(organization.id);

      const counts = await service.adoptUserRows(user, organization);

      expect(counts).toEqual({ userWallets: 1, walletSettings: 1, paymentMethods: 1, stripeTransactions: 1, deploymentSettings: 1, apiKeys: 1, templates: 1 });
      expect(await readOrganizationIds(rows)).toEqual({
        userWallets: { organizationId: organization.id },
        walletSettings: { organizationId: organization.id },
        paymentMethods: { organizationId: organization.id },
        stripeTransactions: { organizationId: organization.id },
        deploymentSettings: { organizationId: organization.id, projectId: project?.id },
        apiKeys: { organizationId: organization.id, projectId: null },
        templates: { organizationId: organization.id, projectId: project?.id }
      });
      expect(await readOrganizationIds(strangerRows)).toEqual({
        userWallets: { organizationId: null },
        walletSettings: { organizationId: null },
        paymentMethods: { organizationId: null },
        stripeTransactions: { organizationId: null },
        deploymentSettings: { organizationId: null, projectId: null },
        apiKeys: { organizationId: null, projectId: null },
        templates: { organizationId: null, projectId: null }
      });
    });

    it("adopts nothing the second time", async () => {
      const { service, user, seedOwnedRows } = await setup();
      await seedOwnedRows(user);
      const organization = await service.ensureForUser(user);
      await service.adoptUserRows(user, organization);

      const counts = await service.adoptUserRows(user, organization);

      expect(Object.values(counts)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    it("leaves rows that already belong to an organization alone", async () => {
      const { service, user, db } = await setup();
      const { organization: other, project: otherProject } = await seedOrganizationWithOwner();
      const deployment = await seedDeploymentSetting({ userId: user.id, organizationId: other.id, projectId: otherProject.id });
      const organization = await service.ensureForUser(user);

      const counts = await service.adoptUserRows(user, organization);

      expect(counts.deploymentSettings).toBe(0);
      const [kept] = await db
        .select()
        .from(resolveTable("DeploymentSettings"))
        .where(eq(resolveTable("DeploymentSettings").id, deployment.id));
      expect(kept).toMatchObject({ organizationId: other.id, projectId: otherProject.id });
    });
  });

  async function setup() {
    const service = container.resolve(PersonalOrganizationService);
    const organizationRepository = container.resolve(OrganizationRepository);
    const organizationMemberRepository = container.resolve(OrganizationMemberRepository);
    const projectRepository = container.resolve(ProjectRepository);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const { user, wallet } = await seedUserWithWallet({ user: { userId: faker.string.uuid(), username: `user-${faker.string.alphanumeric(10)}` } });

    async function seedOwnedRows(owner: UserOutput) {
      const walletSetting = await seedWalletSetting({ userId: owner.id, walletId: wallet.id });
      const [paymentMethod] = await db
        .insert(resolveTable("PaymentMethods"))
        .values({ userId: owner.id, fingerprint: faker.string.uuid(), paymentMethodId: faker.string.uuid() })
        .returning();
      const [stripeTransaction] = await db
        .insert(resolveTable("StripeTransactions"))
        .values({ userId: owner.id, type: "payment_intent", amount: 1000 })
        .returning();
      const deploymentSetting = await seedDeploymentSetting({ userId: owner.id });
      const [apiKey] = await db
        .insert(resolveTable("ApiKeys"))
        .values({ userId: owner.id, hashedKey: faker.string.alphanumeric(64), keyFormat: "ac.sk.test.x", name: "key" })
        .returning();
      const [template] = await db
        .insert(resolveTable("Templates"))
        .values({ userId: owner.userId as string, title: "template", cpu: 1, ram: 1, storage: 1, sdl: "version: '2.0'" })
        .returning();

      return {
        userWallets: wallet.id,
        walletSettings: walletSetting.id,
        paymentMethods: paymentMethod.id,
        stripeTransactions: stripeTransaction.id,
        deploymentSettings: deploymentSetting.id,
        apiKeys: apiKey.id,
        templates: template.id
      };
    }

    async function readOrganizationIds(rows: Awaited<ReturnType<typeof seedOwnedRows>>) {
      const [userWallets] = await db
        .select()
        .from(resolveTable("UserWallets"))
        .where(eq(resolveTable("UserWallets").id, rows.userWallets));
      const [walletSettings] = await db
        .select()
        .from(resolveTable("WalletSetting"))
        .where(eq(resolveTable("WalletSetting").id, rows.walletSettings));
      const [paymentMethods] = await db
        .select()
        .from(resolveTable("PaymentMethods"))
        .where(eq(resolveTable("PaymentMethods").id, rows.paymentMethods));
      const [stripeTransactions] = await db
        .select()
        .from(resolveTable("StripeTransactions"))
        .where(eq(resolveTable("StripeTransactions").id, rows.stripeTransactions));
      const [deploymentSettings] = await db
        .select()
        .from(resolveTable("DeploymentSettings"))
        .where(eq(resolveTable("DeploymentSettings").id, rows.deploymentSettings));
      const [apiKeys] = await db
        .select()
        .from(resolveTable("ApiKeys"))
        .where(eq(resolveTable("ApiKeys").id, rows.apiKeys));
      const [templates] = await db
        .select()
        .from(resolveTable("Templates"))
        .where(eq(resolveTable("Templates").id, rows.templates));

      return {
        userWallets: { organizationId: userWallets.organizationId },
        walletSettings: { organizationId: walletSettings.organizationId },
        paymentMethods: { organizationId: paymentMethods.organizationId },
        stripeTransactions: { organizationId: stripeTransactions.organizationId },
        deploymentSettings: { organizationId: deploymentSettings.organizationId, projectId: deploymentSettings.projectId },
        apiKeys: { organizationId: apiKeys.organizationId, projectId: apiKeys.projectId },
        templates: { organizationId: templates.organizationId, projectId: templates.projectId }
      };
    }

    return { service, user, db, organizationRepository, organizationMemberRepository, projectRepository, seedOwnedRows, readOrganizationIds };
  }
});
