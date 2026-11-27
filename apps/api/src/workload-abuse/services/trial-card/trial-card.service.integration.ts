import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { TrialStartedHandler } from "@src/app/services/trial-started/trial-started.handler";
import { ActivateTrial } from "@src/billing/events/activate-trial";
import { ActivateTrialHandler } from "@src/billing/services/activate-trial/activate-trial.handler";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { TrialEligibilityService } from "@src/billing/services/trial-eligibility/trial-eligibility.service";
import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import type { UserOutput } from "@src/user/repositories";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { TrialCardService } from "./trial-card.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedPersonalOrganizationOf, seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(ActivateTrialHandler), container.resolve(TrialStartedHandler)]);

describe(TrialCardService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts the trial of a held account once its card is verified", async () => {
    const { seedHeldAccount, verifyCard, activateTrial, findWallet, findCardStep } = await setup();
    const account = await seedHeldAccount();
    expect(await findCardStep(account)).toBe("required");

    await verifyCard(account, { fingerprint: `fp_${faker.string.alphanumeric(16)}` });
    await activateTrial(account);

    expect(await findWallet(account)).toMatchObject({ activatedAt: expect.any(Date), isTrialing: true });
    expect(await findCardStep(account)).toBe("verified");
  });

  it("leaves the trial of a held account without a card waiting for one", async () => {
    const { seedHeldAccount, dispatchActivateTrial, awaitActivationRetrying, findWallet } = await setup();
    const account = await seedHeldAccount();

    await dispatchActivateTrial(account);
    await awaitActivationRetrying(account);

    expect(await findWallet(account)).toMatchObject({ activatedAt: null });
  });

  it("refuses a card that started another account's trial, and keeps asking the second account for one", async () => {
    const { seedHeldAccount, verifyCard, findCardStep } = await setup();
    const fingerprint = `fp_${faker.string.alphanumeric(16)}`;
    const first = await seedHeldAccount();
    const second = await seedHeldAccount();
    await verifyCard(first, { fingerprint });

    await expect(verifyCard(second, { fingerprint })).rejects.toMatchObject({ status: 422, errorCode: "trial_card_already_used" });

    expect(await findCardStep(second)).toBe("required");
  });

  it("refuses a prepaid card and leaves it unspent for a later account", async () => {
    const { seedHeldAccount, verifyCard, findCardStep } = await setup();
    const fingerprint = `fp_${faker.string.alphanumeric(16)}`;
    const account = await seedHeldAccount();

    await expect(verifyCard(account, { fingerprint, funding: "prepaid" })).rejects.toMatchObject({ status: 422, errorCode: "trial_card_prepaid" });

    expect(await findCardStep(account)).toBe("required");
  });

  it("keeps a card spent after the account that used it is deleted", async () => {
    const { seedHeldAccount, verifyCard, deleteAccount } = await setup();
    const fingerprint = `fp_${faker.string.alphanumeric(16)}`;
    const first = await seedHeldAccount();
    await verifyCard(first, { fingerprint });
    await deleteAccount(first);
    const second = await seedHeldAccount();

    await expect(verifyCard(second, { fingerprint })).rejects.toMatchObject({ status: 422, errorCode: "trial_card_already_used" });
  });

  it("puts an account with a verified card back behind its hold once the card step is switched off", async () => {
    const { seedHeldAccount, verifyCard, switchCardStep, assertEligible } = await setup();
    const account = await seedHeldAccount();
    await verifyCard(account, { fingerprint: `fp_${faker.string.alphanumeric(16)}` });
    await expect(assertEligible(account)).resolves.toBeUndefined();

    switchCardStep("off");

    await expect(assertEligible(account)).rejects.toMatchObject({ status: 400, message: "Unable to start trial. Please contact support for assistance." });
  });

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const userWallets = resolveTable("UserWallets");
    const users = resolveTable("Users");

    const workloadAbuseConfig = container.resolve(WorkloadAbuseConfigService);
    const readWorkloadAbuseConfig = workloadAbuseConfig.get.bind(workloadAbuseConfig);
    const overrides: Partial<Record<Parameters<typeof readWorkloadAbuseConfig>[0], unknown>> = {
      WORKLOAD_ABUSE_SIGNUP_HOLD_MODE: "off",
      WORKLOAD_ABUSE_GENERATED_EMAIL_TAG_HOLD_MODE: "enforce",
      WORKLOAD_ABUSE_REFUSED_SIGNUP_HOLD_MODE: "off",
      WORKLOAD_ABUSE_EMAIL_DOMAIN_HOLD_MODE: "off",
      WORKLOAD_ABUSE_NEW_EMAIL_DOMAIN_HOLD_MODE: "off",
      WORKLOAD_ABUSE_HELD_TRIAL_CARD_STEP: "on"
    };
    vi.spyOn(workloadAbuseConfig, "get").mockImplementation((key =>
      key in overrides ? overrides[key] : readWorkloadAbuseConfig(key)) as typeof workloadAbuseConfig.get);

    const walletManager = container.resolve(ManagedUserWalletService);
    vi.spyOn(walletManager, "createWallet").mockImplementation(async () => ({ address: createAkashAddress() }));
    vi.spyOn(walletManager, "createAndAuthorizeTrialSpending").mockImplementation(async () => ({
      address: createAkashAddress(),
      limits: { deployment: 7_000_000, fees: 3_000_000 }
    }));
    vi.spyOn(container.resolve(TrialStartedHandler), "handle").mockResolvedValue();

    const stripeService = container.resolve(StripeService);
    const trialCardService = container.resolve(TrialCardService);
    const trialEligibilityService = container.resolve(TrialEligibilityService);
    const activationKeyOf = (account: UserOutput) => `activateTrial.${account.id}`;

    return {
      seedHeldAccount: async () => {
        const account = await seedUser({
          userId: faker.string.uuid(),
          email: `farmer+${faker.string.alpha(4)}${faker.string.numeric(4)}@example.com`.toLowerCase(),
          emailVerified: true,
          stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`
        });
        await seedPersonalOrganizationOf(account);

        return account;
      },
      verifyCard: async (account: UserOutput, card: { fingerprint: string; funding?: string }) => {
        const setupIntentId = `seti_${faker.string.alphanumeric(24)}`;
        vi.spyOn(stripeService, "retrieveSetupIntentWithPaymentMethod").mockResolvedValue(
          mock<Stripe.Response<Stripe.SetupIntent>>({
            id: setupIntentId,
            status: "succeeded",
            customer: account.stripeCustomerId,
            metadata: { trial_card: "true" },
            payment_method: mock<Stripe.PaymentMethod>({
              type: "card",
              card: mock<Stripe.PaymentMethod.Card>({ fingerprint: card.fingerprint, funding: card.funding ?? "credit" })
            })
          })
        );

        await trialCardService.verify(account, setupIntentId);
      },
      findCardStep: (account: UserOutput) => trialEligibilityService.findCardStep(account.id),
      assertEligible: (account: UserOutput) => trialEligibilityService.assertEligible(account.id),
      switchCardStep: (step: "off" | "on") => {
        overrides.WORKLOAD_ABUSE_HELD_TRIAL_CARD_STEP = step;
      },
      deleteAccount: async (account: UserOutput) => {
        await db.delete(users).where(eq(users.id, account.id));
      },
      findWallet: async (account: UserOutput) => {
        const [row] = await db.select().from(userWallets).where(eq(userWallets.userId, account.id));

        return row;
      },
      dispatchActivateTrial: async (account: UserOutput) => {
        await enqueue(new ActivateTrial({ userId: account.id }), { singletonKey: activationKeyOf(account) });
        await startWorkers();
      },
      awaitActivationRetrying: (account: UserOutput) =>
        vi.waitFor(
          async () => {
            const [row] = await findJobRows(ActivateTrial[JOB_NAME], { singletonKey: activationKeyOf(account) });
            expect(row?.state).toBe("retry");
          },
          { timeout: 20_000, interval: 250 }
        ),
      activateTrial: async (account: UserOutput) => {
        await enqueue(new ActivateTrial({ userId: account.id }), { singletonKey: activationKeyOf(account) });
        await startWorkers();
        await expectJobCompleted(ActivateTrial[JOB_NAME], { singletonKey: activationKeyOf(account) });
      }
    };
  }
});
