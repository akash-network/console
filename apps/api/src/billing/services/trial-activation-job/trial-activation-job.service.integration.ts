import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivateTrial } from "@src/billing/events/activate-trial";
import { ActivateTrialHandler } from "@src/billing/services/activate-trial/activate-trial.handler";
import { JOB_NAME } from "@src/core";
import type { UserOutput } from "@src/user/repositories";
import { ReviewTrialSignupHandler } from "@src/workload-abuse/services/review-trial-signup/review-trial-signup.handler";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { TrialActivationJobService } from "./trial-activation-job.service";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { findJobRows, runAsUser, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(ActivateTrialHandler), container.resolve(ReviewTrialSignupHandler)]);

describe(TrialActivationJobService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("assertActivatedForSpend", () => {
    it("asks a held sign-up for credits and queues no activation for it", async () => {
      const { seedAccount, spendAs, findActivationsOf } = await setup();
      await seedAccount();
      await seedAccount();
      const signup = await seedAccount();

      await expect(spendAs(signup)).rejects.toMatchObject({
        status: 402,
        message: "A free trial isn't available for this account, so deploying needs credits. Contact support if you think this is a mistake.",
        errorCode: "trial_unavailable"
      });
      expect(await findActivationsOf(signup)).toEqual([]);
    });

    it("asks a sign-up nothing holds to wait for its trial and queues its activation", async () => {
      const { seedAccount, spendAs, findActivationsOf } = await setup();
      const signup = await seedAccount();

      await expect(spendAs(signup)).rejects.toMatchObject({ status: 409, errorCode: "wallet_provisioning" });
      expect(await findActivationsOf(signup)).toHaveLength(1);
    });

    it("asks a sign-up with an unconfirmed email to confirm it, held or not", async () => {
      const { seedAccount, spendAs, findActivationsOf } = await setup();
      await seedAccount();
      await seedAccount();
      const signup = await seedAccount({ emailVerified: false });

      await expect(spendAs(signup)).rejects.toMatchObject({ status: 403, errorCode: "email_verification_required" });
      expect(await findActivationsOf(signup)).toEqual([]);
    });
  });

  async function setup() {
    await jobWorkers();
    const fingerprint = faker.string.hexadecimal({ length: 64, casing: "lower", prefix: "" });

    const workloadAbuseConfig = container.resolve(WorkloadAbuseConfigService);
    const readWorkloadAbuseConfig = workloadAbuseConfig.get.bind(workloadAbuseConfig);
    const overrides: Partial<Record<Parameters<typeof readWorkloadAbuseConfig>[0], unknown>> = {
      WORKLOAD_ABUSE_SIGNUP_HOLD_MODE: "enforce",
      WORKLOAD_ABUSE_SIGNUP_HOLD_MIN_LINKED_ACCOUNTS: 2,
      WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES: 45
    };
    vi.spyOn(workloadAbuseConfig, "get").mockImplementation((key =>
      key in overrides ? overrides[key] : readWorkloadAbuseConfig(key)) as typeof workloadAbuseConfig.get);

    const service = container.resolve(TrialActivationJobService);

    return {
      seedAccount: (input: { emailVerified?: boolean } = {}) =>
        seedUser({
          userId: faker.string.uuid(),
          email: faker.internet.email().toLowerCase(),
          emailVerified: input.emailVerified ?? true,
          lastFingerprint: fingerprint,
          lastActiveAt: new Date()
        }),
      spendAs: (user: UserOutput) => runAsUser(user, () => service.assertActivatedForSpend({ userId: user.id, activatedAt: null })),
      findActivationsOf: (user: UserOutput) => findJobRows(ActivateTrial[JOB_NAME], { singletonKey: `${ActivateTrial.name}.${user.id}` })
    };
  }
});
