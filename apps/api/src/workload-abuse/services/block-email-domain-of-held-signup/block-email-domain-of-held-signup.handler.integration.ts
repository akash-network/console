import { AuthzHttpService, DeploymentHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { JOB_NAME } from "@src/core";
import { BlockEmailDomainOfHeldSignup, blockEmailDomainOfHeldSignupKeyFor } from "@src/workload-abuse/events/block-email-domain-of-held-signup";
import { BLOCKED_DOMAIN_LOCK_REASON } from "@src/workload-abuse/lib/abuse-lock-reason/abuse-lock-reason";
import { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import { HELD_SIGNUP_BLOCK_REASON, type HeldSignupBlockEvidence } from "@src/workload-abuse/services/email-domain-block/email-domain-block.service";
import { EmailDomainMailProfileService } from "@src/workload-abuse/services/email-domain-mail-profile/email-domain-mail-profile.service";
import {
  LockBlockedDomainWallet,
  LockBlockedDomainWalletHandler,
  lockBlockedDomainWalletKeyFor
} from "@src/workload-abuse/services/lock-blocked-domain-wallet/lock-blocked-domain-wallet.handler";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { BlockEmailDomainOfHeldSignupHandler } from "./block-email-domain-of-held-signup.handler";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(BlockEmailDomainOfHeldSignupHandler), container.resolve(LockBlockedDomainWalletHandler)]);

describe(BlockEmailDomainOfHeldSignupHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks the held user's domain and locks the trials that got through on it before the hold", async () => {
    const { domain, seedHeldSignup, seedTrial, runDomainBlock, findDomain, findWallet } = await setup({ mode: "enforce" });
    const earlierTrial = await seedTrial(`first@${domain}`);
    const held = await seedHeldSignup(`second@${domain}`);

    await runDomainBlock(held.user.id, domain);

    expect(await findDomain()).toMatchObject({ status: "blocked", source: "auto", reason: HELD_SIGNUP_BLOCK_REASON, triggeredByUserId: held.user.id });
    await expectJobCompleted(LockBlockedDomainWallet[JOB_NAME], { singletonKey: lockBlockedDomainWalletKeyFor(earlierTrial.wallet.id) });
    expect(await findWallet(earlierTrial.wallet.id)).toMatchObject({ isTrialing: false, abuseLockedReason: BLOCKED_DOMAIN_LOCK_REASON });
  });

  it("writes nothing and locks nothing in report mode", async () => {
    const { domain, seedHeldSignup, seedTrial, runDomainBlock, findDomain, findSiblingLocks } = await setup({ mode: "report" });
    const earlierTrial = await seedTrial(`first@${domain}`);
    const held = await seedHeldSignup(`second@${domain}`);

    await runDomainBlock(held.user.id, domain);

    expect(await findDomain()).toBeUndefined();
    expect(await findSiblingLocks(earlierTrial.wallet.id)).toEqual([]);
  });

  it("leaves a domain alone that an account older than the attack vouches for", async () => {
    const { domain, seedHeldSignup, seedTrial, runDomainBlock, findDomain, findSiblingLocks } = await setup({ mode: "enforce" });
    const established = await seedTrial(`founder@${domain}`, {
      createdAt: faker.date.past({ years: 1, refDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) })
    });
    const held = await seedHeldSignup(`second@${domain}`);

    await runDomainBlock(held.user.id, domain);

    expect(await findDomain()).toBeUndefined();
    expect(await findSiblingLocks(established.wallet.id)).toEqual([]);
  });

  it("leaves alone the domain a held user's address moved to while the block waited in the queue", async () => {
    const { domain, seedHeldSignup, seedTrial, runDomainBlock, findDomain, findSiblingLocks } = await setup({ mode: "enforce" });
    const trialOnNewDomain = await seedTrial(`first@${domain}`);
    const held = await seedHeldSignup(`second@${domain}`);

    await runDomainBlock(held.user.id, "assessed-farm.test");

    expect(await findDomain()).toBeUndefined();
    expect(await findSiblingLocks(trialOnNewDomain.wallet.id)).toEqual([]);
  });

  async function setup(input: { mode: "report" | "enforce" }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const userWalletRepository = container.resolve(UserWalletRepository);
    const blockedEmailDomainRepository = container.resolve(BlockedEmailDomainRepository);
    const domain = `${faker.string.alpha({ length: 12, casing: "lower" })}.test`;

    const config = container.resolve(WorkloadAbuseConfigService);
    const readConfig = config.get.bind(config);
    vi.spyOn(config, "get").mockImplementation((key =>
      key === "WORKLOAD_ABUSE_HELD_SIGNUP_DOMAIN_BLOCK_MODE" ? input.mode : readConfig(key)) as typeof config.get);

    vi.spyOn(container.resolve(EmailDomainMailProfileService), "recordProfile").mockResolvedValue(true);
    vi.spyOn(container.resolve(TxManagerService), "getFundingWalletAddress").mockResolvedValue(createAkashAddress());
    vi.spyOn(container.resolve(AuthzHttpService), "hasDepositDeploymentGrant").mockResolvedValue(true);
    vi.spyOn(container.resolve(AuthzHttpService), "hasFeeAllowance").mockResolvedValue(true);
    vi.spyOn(container.resolve(DeploymentHttpService), "findAll").mockResolvedValue({ deployments: [], pagination: { next_key: null, total: "0" } });
    vi.spyOn(container.resolve(ManagedSignerService), "executeFundingTx").mockResolvedValue(
      mock<Awaited<ReturnType<ManagedSignerService["executeFundingTx"]>>>()
    );

    async function seedTrial(email: string, user: { createdAt?: Date } = {}) {
      return await seedUserWithWallet({ user: { email, ...user }, isTrialing: true, activatedAt: new Date() });
    }

    async function seedHeldSignup(email: string) {
      return { user: await seedUser({ email }) };
    }

    async function runDomainBlock(userId: string, emailDomain: string) {
      const singletonKey = blockEmailDomainOfHeldSignupKeyFor(userId);
      const evidence: HeldSignupBlockEvidence = { signal: "mail_server_shared_with_blocked_domain", blockedDomain: "wexdano.test" };

      await enqueue(new BlockEmailDomainOfHeldSignup({ userId, emailDomain, evidence }), { singletonKey });
      await startWorkers();
      await expectJobCompleted(BlockEmailDomainOfHeldSignup[JOB_NAME], { singletonKey });
    }

    return {
      domain,
      seedTrial,
      seedHeldSignup,
      runDomainBlock,
      findDomain: () => blockedEmailDomainRepository.findByDomain(domain),
      findWallet: (walletId: number) => userWalletRepository.findById(walletId),
      findSiblingLocks: (walletId: number) => findJobRows(LockBlockedDomainWallet[JOB_NAME], { singletonKey: lockBlockedDomainWalletKeyFor(walletId) })
    };
  }
});
