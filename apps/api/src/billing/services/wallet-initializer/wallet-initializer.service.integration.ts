import { count, eq, inArray, max, min, type SQL } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { PersonalOrganizationService } from "@src/organization/services/personal-organization/personal-organization.service";
import { UserRepository } from "@src/user/repositories";
import { WalletInitializerService } from "./wallet-initializer.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

describe(WalletInitializerService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("ensureTeamWallet", () => {
    it("provisions a wallet owned by no user, without a trial, with the address its row id derives", async () => {
      const { service, findWallets } = setup();
      const { user, organization } = await seedOrganizationWithOwner();
      const derivedAddress = createAkashAddress();
      const createWallet = vi.spyOn(container.resolve(ManagedUserWalletService), "createWallet").mockResolvedValue({ address: derivedAddress });

      const wallet = await service.ensureTeamWallet(organization, user.id);

      expect(await findWallets(eq(resolveTable("UserWallets").organizationId, organization.id))).toEqual([
        expect.objectContaining({
          id: wallet.id,
          userId: null,
          organizationId: organization.id,
          createdByUserId: user.id,
          isTrialing: false,
          activatedAt: null,
          address: derivedAddress
        })
      ]);
      expect(createWallet).toHaveBeenCalledWith({ addressIndex: wallet.id });
    });

    it("creates one wallet however many times provisioning runs at once", async () => {
      const { service, findWallets } = setup();
      const { user, organization } = await seedOrganizationWithOwner();

      const wallets = await Promise.all([1, 2, 3].map(() => service.ensureTeamWallet(organization, user.id)));

      expect(new Set(wallets.map(wallet => wallet.id)).size).toBe(1);
      expect(await findWallets(eq(resolveTable("UserWallets").organizationId, organization.id))).toHaveLength(1);
    });
  });

  describe("ensureWallet", () => {
    it("files a new user's wallet into their personal organization, even while a team organization is active", async () => {
      const { service, executionContextService, findWallets } = setup();
      const user = await seedUser();
      const personalOrganization = await container.resolve(PersonalOrganizationService).ensureForUser(user);
      const { organization: team } = await seedOrganizationWithOwner();

      const wallet = await executionContextService.runWithContext(async () => {
        executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId: team.id, organizationType: "team" }));
        return await service.ensureWallet(user.id);
      });

      expect(await findWallets(eq(resolveTable("UserWallets").userId, user.id))).toEqual([
        expect.objectContaining({ id: wallet.id, organizationId: personalOrganization.id, createdByUserId: user.id, isTrialing: true })
      ]);
      expect(await findWallets(eq(resolveTable("UserWallets").organizationId, team.id))).toEqual([]);
    });

    it("returns the user's existing wallet while a team organization is active", async () => {
      const { service, executionContextService } = setup();
      const { user, wallet } = await seedUserWithWallet();
      const { organization: team } = await seedOrganizationWithOwner();

      const ensured = await executionContextService.runWithContext(async () => {
        executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId: team.id, organizationType: "team" }));
        return await service.ensureWallet(user.id);
      });

      expect(ensured).toMatchObject({ id: wallet.id, address: wallet.address });
    });
  });

  it("never renumbers, re-keys or drops an existing wallet while wallets move to organizations", async () => {
    const { service, findWallets, walletIdRange } = setup();
    const accounts = await Promise.all([1, 2, 3].map(() => seedUserWithWallet()));
    const walletIds = accounts.map(({ wallet }) => wallet.id);
    const before = await findWallets(inArray(resolveTable("UserWallets").id, walletIds));
    const rangeBefore = await walletIdRange();

    for (const { user } of accounts) {
      const organization = await container.resolve(PersonalOrganizationService).ensureForUser(user);
      await container.resolve(PersonalOrganizationService).adoptUserRows(user, organization);
      await service.ensureWallet(user.id);
    }
    const { user: teamOwner, organization: team } = await seedOrganizationWithOwner();
    const teamWallet = await service.ensureTeamWallet(team, teamOwner.id);
    await container.resolve(UserRepository).deleteById(accounts[0].user.id);

    const after = await findWallets(inArray(resolveTable("UserWallets").id, walletIds));
    expect(after.map(({ id, address }) => ({ id, address }))).toEqual(before.map(({ id, address }) => ({ id, address })));
    expect(after.find(wallet => wallet.id === accounts[0].wallet.id)).toMatchObject({ userId: null });
    expect(await walletIdRange()).toEqual({ min: rangeBefore.min, max: teamWallet.id, count: rangeBefore.count + 1 });
    expect(teamWallet.id).toBeGreaterThan(rangeBefore.max!);
  });

  function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const wallets = resolveTable("UserWallets");

    return {
      service: container.resolve(WalletInitializerService),
      executionContextService: container.resolve(ExecutionContextService),
      findWallets: async (where: SQL | undefined) => await db.select().from(wallets).where(where).orderBy(wallets.id),
      walletIdRange: async () => {
        const [range] = await db.select({ min: min(wallets.id), max: max(wallets.id), count: count() }).from(wallets);
        return range;
      }
    };
  }
});
