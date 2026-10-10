import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { setTimeout as delay } from "node:timers/promises";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { MAX_NUMBERED_SLUG_SUFFIX, toSlug } from "@src/organization/lib/slug/slug";
import type { OrganizationOutput } from "@src/organization/repositories/organization/organization.repository";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories";
import {
  MAX_TEAM_ORGANIZATIONS_PER_USER,
  ORGANIZATION_LIMIT_REACHED_ERROR_CODE,
  ORGANIZATION_NAME_TAKEN_ERROR_CODE,
  TeamOrganizationService
} from "./team-organization.service";

import { seedOrganization, seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

describe(TeamOrganizationService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("create", () => {
    it("commits the team organization, its owner, its default project and a wallet without a trial together", async () => {
      const { service, user, runAs, readTeam } = await setup();
      const name = uniqueName();

      const { organization } = await runAs(user, () => service.create(name));

      expect(await readTeam(organization.id)).toEqual({
        organization: expect.objectContaining({ name, slug: toSlug(name), type: "team", createdByUserId: user.id, deletedAt: null }),
        members: [expect.objectContaining({ userId: user.id, role: "owner" })],
        projects: [expect.objectContaining({ name: "default", slug: "default", isDefault: true, createdByUserId: user.id })],
        wallets: [
          expect.objectContaining({
            userId: null,
            createdByUserId: user.id,
            isTrialing: false,
            activatedAt: null,
            address: expect.stringMatching(/^akash1/)
          })
        ]
      });
    });

    it("leaves nothing behind when the wallet cannot be provisioned", async () => {
      const { service, user, runAs, db } = await setup();
      vi.spyOn(container.resolve(ManagedUserWalletService), "createWallet").mockRejectedValue(new Error("derivation failed"));

      await expect(runAs(user, () => service.create("Acme Corp"))).rejects.toThrow("derivation failed");

      const organizations = await db.select().from(resolveTable("Organizations")).where(eq(resolveTable("Organizations").createdByUserId, user.id));
      const wallets = await db.select().from(resolveTable("UserWallets")).where(eq(resolveTable("UserWallets").createdByUserId, user.id));
      expect(organizations.map(organization => organization.type)).toEqual(["personal"]);
      expect(wallets).toEqual([]);
    });

    it("takes the next numbered slug when another organization holds the name's slug", async () => {
      const { service, user, runAs } = await setup();
      const name = uniqueName();
      await seedOrganization({ slug: toSlug(name), deletedAt: new Date() });

      const { organization } = await runAs(user, () => service.create(name));

      expect(organization.slug).toBe(`${toSlug(name)}-2`);
    });

    it("takes a random slug suffix once every numbered slug of the name is held", async () => {
      const { service, user, runAs } = await setup();
      const name = uniqueName();
      const slug = toSlug(name);
      await seedOrganization({ slug, deletedAt: new Date() });
      for (let suffix = 2; suffix <= MAX_NUMBERED_SLUG_SUFFIX; suffix++) {
        await seedOrganization({ slug: `${slug}-${suffix}`, deletedAt: new Date() });
      }

      const { organization } = await runAs(user, () => service.create(name));

      expect(organization.slug).toMatch(new RegExp(`^${slug}-[0-9a-f]{8}$`));
    });

    it("lets only one of several concurrent creations past the limit", async () => {
      const { service, user, runAs, slowDownWalletProvisioning, countTeamsCreatedBy } = await setup();
      await seedTeamsCreatedBy(user, MAX_TEAM_ORGANIZATIONS_PER_USER - 1);
      slowDownWalletProvisioning();

      const outcomes = await Promise.allSettled([1, 2, 3].map(index => runAs(user, () => service.create(`Team ${index}`))));

      expect(outcomes.map(outcome => outcome.status).sort()).toEqual(["fulfilled", "rejected", "rejected"]);
      expect(outcomes.filter(outcome => outcome.status === "rejected")).toEqual([
        expect.objectContaining({ reason: expect.objectContaining({ status: 403, errorCode: ORGANIZATION_LIMIT_REACHED_ERROR_CODE }) }),
        expect.objectContaining({ reason: expect.objectContaining({ status: 403, errorCode: ORGANIZATION_LIMIT_REACHED_ERROR_CODE }) })
      ]);
      expect(await countTeamsCreatedBy(user)).toBe(MAX_TEAM_ORGANIZATIONS_PER_USER);
    });

    it("counts deleted organizations toward the limit", async () => {
      const { service, user, runAs } = await setup();
      await seedTeamsCreatedBy(user, MAX_TEAM_ORGANIZATIONS_PER_USER, { deletedAt: new Date() });

      await expect(runAs(user, () => service.create("Acme Corp"))).rejects.toMatchObject({ status: 403, errorCode: ORGANIZATION_LIMIT_REACHED_ERROR_CODE });
    });

    it("lets only one of several concurrent creations with the same name through, whatever its case", async () => {
      const { service, user, runAs, slowDownWalletProvisioning, countTeamsCreatedBy } = await setup();
      slowDownWalletProvisioning();

      const outcomes = await Promise.allSettled(["Acme Corp", "ACME CORP", "acme corp"].map(name => runAs(user, () => service.create(name))));

      expect(outcomes.map(outcome => outcome.status).sort()).toEqual(["fulfilled", "rejected", "rejected"]);
      expect(outcomes.filter(outcome => outcome.status === "rejected")).toEqual([
        expect.objectContaining({ reason: expect.objectContaining({ status: 409, errorCode: ORGANIZATION_NAME_TAKEN_ERROR_CODE }) }),
        expect.objectContaining({ reason: expect.objectContaining({ status: 409, errorCode: ORGANIZATION_NAME_TAKEN_ERROR_CODE }) })
      ]);
      expect(await countTeamsCreatedBy(user)).toBe(1);
    });

    it("reuses the name of a deleted organization or of one the caller left", async () => {
      const { service, user, runAs } = await setup();
      const { organization: deleted } = await seedOrganizationWithOwner({ name: "Acme Corp", deletedAt: new Date() });
      await seedOrganizationMember({ organizationId: deleted.id, userId: user.id });
      await seedOrganizationWithOwner({ name: "Acme Corp" });

      await expect(runAs(user, () => service.create("acme corp"))).resolves.toMatchObject({ organization: expect.objectContaining({ name: "acme corp" }) });
    });
  });

  describe("rename", () => {
    it("lets only one of a rename and a creation to the same name through", async () => {
      const { service, user, runAs, slowDownWalletProvisioning } = await setup();
      const { organization: team } = await seedOrganizationWithOwner();
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role: "admin" });
      slowDownWalletProvisioning();

      const outcomes = await Promise.allSettled([
        runAs(user, () => service.create("Shared Name")),
        runAs(user, () => service.rename(team.id, "SHARED NAME"), createOrganizationContext({ organizationId: team.id, organizationType: "team", role: "admin" }))
      ]);

      expect(outcomes.map(outcome => outcome.status).sort()).toEqual(["fulfilled", "rejected"]);
      expect(outcomes.find(outcome => outcome.status === "rejected")).toMatchObject({
        reason: expect.objectContaining({ status: 409, errorCode: ORGANIZATION_NAME_TAKEN_ERROR_CODE })
      });
    });

    it("keeps the slug of a renamed organization", async () => {
      const { service, user, runAs, db } = await setup();
      const { organization: team } = await seedOrganizationWithOwner();
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role: "owner" });

      await runAs(user, () => service.rename(team.id, "Acme Labs"), createOrganizationContext({ organizationId: team.id, organizationType: "team" }));

      const [renamed] = await db.select().from(resolveTable("Organizations")).where(eq(resolveTable("Organizations").id, team.id));
      expect(renamed).toMatchObject({ name: "Acme Labs", slug: team.slug });
    });
  });

  function uniqueName() {
    return `Acme ${faker.string.alphanumeric(10)}`;
  }

  async function seedTeamsCreatedBy(user: UserOutput, count: number, overrides: Partial<OrganizationOutput> = {}) {
    for (let index = 0; index < count; index++) {
      await seedOrganization({ createdByUserId: user.id, type: "team", ...overrides });
    }
  }

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const service = container.resolve(TeamOrganizationService);
    const executionContextService = container.resolve(ExecutionContextService);
    const abilityService = container.resolve(AbilityService);
    const walletInitializerService = container.resolve(WalletInitializerService);
    const { user, organization: personal } = await seedOrganizationWithOwner({ type: "personal" });

    function runAs<R>(caller: UserOutput, act: () => Promise<R>, context?: OrganizationContext) {
      return executionContextService.runWithContext(async () => {
        executionContextService.set("CURRENT_USER", caller);
        executionContextService.set("ORGANIZATION_CONTEXT", context ?? createOrganizationContext({ organizationId: personal.id, organizationType: "personal" }));
        executionContextService.set("ABILITY", abilityService.getAbilityFor("REGULAR_USER", caller));

        return await act();
      });
    }

    function slowDownWalletProvisioning() {
      const ensureTeamWallet = walletInitializerService.ensureTeamWallet.bind(walletInitializerService);
      vi.spyOn(walletInitializerService, "ensureTeamWallet").mockImplementation(async (...args) => {
        await delay(100);
        return await ensureTeamWallet(...args);
      });
    }

    async function countTeamsCreatedBy(caller: UserOutput) {
      const organizations = await db.select().from(resolveTable("Organizations")).where(eq(resolveTable("Organizations").createdByUserId, caller.id));

      return organizations.filter(organization => organization.type === "team").length;
    }

    async function readTeam(organizationId: string) {
      const [organization] = await db.select().from(resolveTable("Organizations")).where(eq(resolveTable("Organizations").id, organizationId));
      const members = await db.select().from(resolveTable("OrganizationMembers")).where(eq(resolveTable("OrganizationMembers").organizationId, organizationId));
      const projects = await db.select().from(resolveTable("Projects")).where(eq(resolveTable("Projects").organizationId, organizationId));
      const wallets = await db.select().from(resolveTable("UserWallets")).where(eq(resolveTable("UserWallets").organizationId, organizationId));

      return { organization, members, projects, wallets };
    }

    return { db, service, user, personal, runAs, slowDownWalletProvisioning, countTeamsCreatedBy, readTeam };
  }
});
