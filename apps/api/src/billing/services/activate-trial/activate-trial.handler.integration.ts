import "@src/app/providers/jobs.provider";

import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TrialStartedHandler } from "@src/app/services/trial-started/trial-started.handler";
import { ActivateTrial } from "@src/billing/events/activate-trial";
import { TrialStarted } from "@src/billing/events/trial-started";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { DOMAIN_EVENT_NAME } from "@src/core/services/domain-events/domain-events.service";
import { PersonalOrganizationService } from "@src/organization/services/personal-organization/personal-organization.service";
import { ActivateTrialHandler } from "./activate-trial.handler";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedOrganization, seedOrganizationMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const DEPLOYMENT_LIMIT = 7_000_000;
const FEE_LIMIT = 3_000_000;

/** The allowance columns are numeric(20, 2), so what the chain granted comes back scaled. */
const STORED_DEPLOYMENT_LIMIT = "7000000.00";
const STORED_FEE_LIMIT = "3000000.00";

const jobWorkers = useJobWorkers(() => [container.resolve(ActivateTrialHandler), container.resolve(TrialStartedHandler)]);

describe(ActivateTrialHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("activates the wallet with the trial limits the chain granted", async () => {
    const { activateTrial, findWallet } = await setup();

    await activateTrial();

    expect(await findWallet()).toMatchObject({
      activatedAt: expect.any(Date),
      deploymentAllowance: STORED_DEPLOYMENT_LIMIT,
      feeAllowance: STORED_FEE_LIMIT
    });
  });

  it("announces the started trial so its email sequence gets scheduled", async () => {
    const { userId, activateTrial, findTrialStartedEvents } = await setup();

    await activateTrial();

    expect(await findTrialStartedEvents()).toHaveLength(1);
    expect((await findTrialStartedEvents())[0].data).toMatchObject({ userId });
  });

  it("announces nothing the second time for a wallet already activated", async () => {
    const { activateTrial, findTrialStartedEvents } = await setup();

    await activateTrial();
    await activateTrial({ again: true });

    expect(await findTrialStartedEvents()).toHaveLength(1);
  });

  it("activates the user's own wallet and never the team organization they created before the job ran", async () => {
    const { activateTrial, findWallet, seedCreatedTeamWallet } = await setup();
    const teamWallet = await seedCreatedTeamWallet();

    await activateTrial();

    expect(await findWallet()).toMatchObject({ isTrialing: true, activatedAt: expect.any(Date), deploymentAllowance: STORED_DEPLOYMENT_LIMIT });
    expect(await findWallet(teamWallet.id)).toMatchObject({ isTrialing: false, activatedAt: null, deploymentAllowance: "0.00", feeAllowance: "0.00" });
  });

  it("activates nothing for a user whose email is not verified", async () => {
    const { dispatchActivateTrial, awaitActivationRetrying, findWallet, findTrialStartedEvents } = await setup({ emailVerified: false });

    await dispatchActivateTrial();
    await awaitActivationRetrying();

    expect(await findWallet()).toBeUndefined();
    expect(await findTrialStartedEvents()).toHaveLength(0);
  });

  async function setup(input: { emailVerified?: boolean } = {}) {
    const { enqueue, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const userWalletsTable = resolveTable("UserWallets");

    const user = await seedUser({ email: "trial@example.com", emailVerified: input.emailVerified ?? true });
    const address = createAkashAddress();

    const walletManager = container.resolve(ManagedUserWalletService);
    vi.spyOn(walletManager, "createWallet").mockResolvedValue({ address });
    vi.spyOn(walletManager, "createAndAuthorizeTrialSpending").mockResolvedValue({
      address,
      limits: { deployment: DEPLOYMENT_LIMIT, fees: FEE_LIMIT }
    });
    vi.spyOn(container.resolve(TrialStartedHandler), "handle").mockResolvedValue();

    const activationKey = `activateTrial.${user.id}`;

    return {
      userId: user.id,
      findWallet: async (walletId?: number) => {
        const [row] = await db
          .select()
          .from(userWalletsTable)
          .where(walletId === undefined ? eq(userWalletsTable.userId, user.id) : eq(userWalletsTable.id, walletId));

        return row;
      },
      seedCreatedTeamWallet: async () => {
        await container.resolve(PersonalOrganizationService).ensureForUser(user);
        const team = await seedOrganization({ createdByUserId: user.id, type: "team" });
        await seedOrganizationMember({ organizationId: team.id, userId: user.id, role: "owner" });
        const [teamWallet] = await db
          .insert(userWalletsTable)
          .values({ userId: null, organizationId: team.id, createdByUserId: user.id, address: createAkashAddress(), isTrialing: false })
          .returning();

        return teamWallet;
      },
      findTrialStartedEvents: () => findJobRows<{ userId: string }>(TrialStarted[DOMAIN_EVENT_NAME], { data: { userId: user.id } }),
      dispatchActivateTrial: async () => {
        await enqueue(new ActivateTrial({ userId: user.id }), { singletonKey: activationKey });
        await startWorkers();
      },
      awaitActivationRetrying: () =>
        vi.waitFor(
          async () => {
            const [row] = await findJobRows(ActivateTrial[JOB_NAME], { singletonKey: activationKey });
            expect(row?.state).toBe("retry");
          },
          { timeout: 20_000, interval: 250 }
        ),
      activateTrial: async (options: { again?: boolean } = {}) => {
        const key = options.again ? `${activationKey}.again` : activationKey;
        await enqueue(new ActivateTrial({ userId: user.id }), { singletonKey: key });
        await startWorkers();
        await expectJobCompleted(ActivateTrial[JOB_NAME], { singletonKey: key });
      }
    };
  }
});
