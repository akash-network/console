import { faker } from "@faker-js/faker";
import { and, count, eq, inArray, isNull, max, min, type SQL } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TrialStarted } from "@src/billing/events/trial-started";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { PersonalOrganizationService } from "@src/organization/services/personal-organization/personal-organization.service";
import { UserRepository } from "@src/user/repositories";
import { WalletInitializerService } from "./wallet-initializer.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedOrganization, seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

const TRIAL_DEPLOYMENT_LIMIT = 7_000_000;
const TRIAL_FEE_LIMIT = 3_000_000;
const STORED_TRIAL_DEPLOYMENT_LIMIT = "7000000.00";

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

  describe("initializeAndGrantTrialLimits", () => {
    it("activates the user's own wallet and leaves the team organization they created without a trial, even while that team is active", async () => {
      const { service, executionContextService, findWallets, grantTrial, seedTrialCandidate } = setup();
      const { user, personalOrganization, wallet } = await seedTrialCandidate();
      const team = await seedTeamCreatedBy(user.id);
      const teamWallet = await service.ensureTeamWallet(team, user.id);

      await executionContextService.runWithContext(async () => {
        executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId: team.id, organizationType: "team" }));
        return await service.initializeAndGrantTrialLimits(user.id);
      });

      expect(grantTrial).toHaveBeenCalledTimes(1);
      expect(grantTrial).toHaveBeenCalledWith(expect.anything(), { addressIndex: wallet.id });
      expect(await findWallets(eq(resolveTable("UserWallets").id, wallet.id))).toEqual([
        expect.objectContaining({
          organizationId: personalOrganization.id,
          isTrialing: true,
          activatedAt: expect.any(Date),
          deploymentAllowance: STORED_TRIAL_DEPLOYMENT_LIMIT
        })
      ]);
      expect(await findWallets(eq(resolveTable("UserWallets").id, teamWallet.id))).toEqual([
        expect.objectContaining({ isTrialing: false, activatedAt: null, deploymentAllowance: "0.00", feeAllowance: "0.00" })
      ]);
    });

    it("grants one trial and announces it once when two activations of the same user run at once", async () => {
      const { service, findWallets, grantTrial, publish, seedTrialCandidate } = setup({ grantDelayMs: 200 });
      const { user, wallet } = await seedTrialCandidate();

      const activations = await Promise.all([service.initializeAndGrantTrialLimits(user.id), service.initializeAndGrantTrialLimits(user.id)]);

      expect(grantTrial).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith(new TrialStarted({ userId: user.id }));
      expect(activations.map(activation => activation.id)).toEqual([wallet.id, wallet.id]);
      expect(await findWallets(eq(resolveTable("UserWallets").id, wallet.id))).toEqual([
        expect.objectContaining({ activatedAt: expect.any(Date), deploymentAllowance: STORED_TRIAL_DEPLOYMENT_LIMIT })
      ]);
    });

    it("holds a payment that activates the wallet while the grant is in flight until the grant is saved", async () => {
      const events: string[] = [];
      let paymentClaim: Promise<unknown[]> | undefined;
      const { service, publish, seedTrialCandidate } = setup({
        duringGrant: async (db, walletId) => {
          const wallets = resolveTable("UserWallets");
          paymentClaim = db
            .update(wallets)
            .set({ activatedAt: new Date() })
            .where(and(eq(wallets.id, walletId), isNull(wallets.activatedAt)))
            .returning()
            .then(claimed => {
              events.push("payment claimed");
              return claimed;
            });
          await new Promise(resolve => setTimeout(resolve, 100));
          events.push("grant landed");
        }
      });
      const { user } = await seedTrialCandidate();

      await service.initializeAndGrantTrialLimits(user.id);

      expect(await paymentClaim).toEqual([]);
      expect(events).toEqual(["grant landed", "payment claimed"]);
      expect(publish).toHaveBeenCalledWith(new TrialStarted({ userId: user.id }));
    });

    it("grants no new trial to a user who used theirs before organizations existed, after they create a team", async () => {
      const { service, findWallets, grantTrial, publish } = setup();
      const usedAt = new Date("2025-01-15T00:00:00.000Z");
      const { user, wallet } = await seedUserWithWallet({
        user: { emailVerified: true },
        isTrialing: false,
        activatedAt: usedAt,
        deploymentAllowance: "12.50",
        feeAllowance: "3.00"
      });
      const personalOrganization = await container.resolve(PersonalOrganizationService).ensureForUser(user);
      await container.resolve(PersonalOrganizationService).adoptUserRows(user, personalOrganization);
      const team = await seedTeamCreatedBy(user.id);
      await service.ensureTeamWallet(team, user.id);

      await service.initializeAndGrantTrialLimits(user.id);

      expect(grantTrial).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
      expect(await findWallets(eq(resolveTable("UserWallets").userId, user.id))).toEqual([
        expect.objectContaining({
          id: wallet.id,
          organizationId: personalOrganization.id,
          isTrialing: false,
          activatedAt: usedAt,
          deploymentAllowance: "12.50",
          feeAllowance: "3.00"
        })
      ]);
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

  async function seedTeamCreatedBy(userId: string) {
    const team = await seedOrganization({ createdByUserId: userId, type: "team" });
    await seedOrganizationMember({ organizationId: team.id, userId, role: "owner" });

    return team;
  }

  function setup(input: { grantDelayMs?: number; duringGrant?: (db: ApiPgDatabase, walletId: number) => Promise<unknown> } = {}) {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const wallets = resolveTable("UserWallets");
    const service = container.resolve(WalletInitializerService);
    const grantTrial = vi
      .spyOn(container.resolve(ManagedUserWalletService), "createAndAuthorizeTrialSpending")
      .mockImplementation(async (_signer, { addressIndex }) => {
        await new Promise(resolve => setTimeout(resolve, input.grantDelayMs ?? 0));
        await input.duringGrant?.(db, addressIndex);
        return { address: `granted-${addressIndex}`, limits: { deployment: TRIAL_DEPLOYMENT_LIMIT, fees: TRIAL_FEE_LIMIT } };
      });
    const publish = vi.spyOn(container.resolve(DomainEventsService), "publish").mockResolvedValue(null);

    return {
      service,
      grantTrial,
      publish,
      executionContextService: container.resolve(ExecutionContextService),
      findWallets: async (where: SQL | undefined) => await db.select().from(wallets).where(where).orderBy(wallets.id),
      walletIdRange: async () => {
        const [range] = await db.select({ min: min(wallets.id), max: max(wallets.id), count: count() }).from(wallets);
        return range;
      },
      seedTrialCandidate: async () => {
        const user = await seedUser({ email: faker.internet.email().toLowerCase(), emailVerified: true });
        const personalOrganization = await container.resolve(PersonalOrganizationService).ensureForUser(user);
        const wallet = await service.ensureWallet(user.id);

        return { user, personalOrganization, wallet };
      }
    };
  }
});
