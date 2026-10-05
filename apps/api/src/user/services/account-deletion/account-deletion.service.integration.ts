import { faker } from "@faker-js/faker";
import { createHash } from "crypto";
import { addMinutes } from "date-fns";
import { eq, type SQL, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { AccountDeletionTokenRepository } from "@src/user/repositories/account-deletion-token/account-deletion-token.repository";
import { UserTemplateRepository } from "@src/user/repositories/user-template/user-template.repository";
import { PurgeDeletedAccount, PurgeDeletedAccountHandler } from "@src/user/services/purge-deleted-account/purge-deleted-account.handler";
import { AccountDeletionService } from "./account-deletion.service";

import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { seedWalletSetting } from "@test/seeders/db/wallet-setting.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const DEPLOYMENT_LIST_PATH = "/akash/deployment/v1beta4/deployments/list";

const jobWorkers = useJobWorkers(() => [container.resolve(PurgeDeletedAccountHandler)]);

describe(AccountDeletionService.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("erases every row the account owns and nothing anyone else owns", async () => {
    const { service, db, account, bystander, token, answerActiveDeployments, countRowsOwnedBy } = await setup();
    answerActiveDeployments([]);

    await service.confirm({ token });

    expect(await countRowsOwnedBy(account)).toEqual({
      users: 0,
      userWallets: 0,
      walletSettings: 0,
      deploymentSettings: 0,
      apiKeys: 0,
      emailVerificationCodes: 0,
      paymentMethods: 0,
      stripeTransactions: 0,
      hardwareRequests: 0,
      workloadAbuseDetections: 0,
      workloadProbeEvidence: 0,
      accountDeletionTokens: 0,
      templates: 0,
      templateFavorites: 0
    });
    expect(await countRowsOwnedBy(bystander)).toEqual({
      users: 1,
      userWallets: 1,
      walletSettings: 1,
      deploymentSettings: 1,
      apiKeys: 1,
      emailVerificationCodes: 1,
      paymentMethods: 1,
      stripeTransactions: 1,
      hardwareRequests: 1,
      workloadAbuseDetections: 1,
      workloadProbeEvidence: 1,
      accountDeletionTokens: 0,
      templates: 2,
      templateFavorites: 0
    });
    const [blockedDomain] = await db
      .select()
      .from(resolveTable("BlockedEmailDomains"))
      .where(eq(resolveTable("BlockedEmailDomains").domain, account.blockedDomain));
    expect(blockedDomain.triggeredByUserId).toBeNull();
  });

  it("queues the cleanup of the identity and payment records the database cannot reach", async () => {
    const { service, account, token, answerActiveDeployments } = await setup();
    answerActiveDeployments([]);

    await service.confirm({ token });

    const jobs = await findJobRows(PurgeDeletedAccount[JOB_NAME], { data: { userId: account.user.id } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data).toEqual({
      userId: account.user.id,
      auth0UserId: account.user.userId,
      stripeCustomerId: account.user.stripeCustomerId,
      version: 1
    });
  });

  it("leaves the account untouched while it still has an active deployment", async () => {
    const { service, account, token, answerActiveDeployments, countRowsOwnedBy } = await setup();
    answerActiveDeployments([account.address]);

    await expect(service.confirm({ token })).rejects.toMatchObject({ status: 409 });

    expect(await countRowsOwnedBy(account)).toEqual(expect.objectContaining({ users: 1, userWallets: 1, templates: 1, accountDeletionTokens: 1 }));
    expect(await findJobRows(PurgeDeletedAccount[JOB_NAME], { data: { userId: account.user.id } })).toHaveLength(0);
  });

  async function setup() {
    await jobWorkers();
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const templateRepository = container.resolve(UserTemplateRepository);
    const restApiNodeUrl = container.resolve(CoreConfigService).get("REST_API_NODE_URL");

    const account = await seedAccount();
    const bystander = await seedAccount();

    const sharedTemplateId = await templateRepository.upsert(null, bystander.user.userId!, templateInput());
    await templateRepository.addFavorite(account.user.userId!, sharedTemplateId);
    await templateRepository.addFavorite(bystander.user.userId!, account.templateId);

    const token = faker.string.alphanumeric(43);
    await container.resolve(AccountDeletionTokenRepository).replaceForUser({
      userId: account.user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      acknowledgedForfeitUsd: 0,
      expiresAt: addMinutes(new Date(), 10)
    });

    async function seedAccount() {
      const { user, wallet, address } = await seedUserWithWallet({
        isTrialing: true,
        user: { userId: `auth0|${faker.string.alphanumeric(24)}`, stripeCustomerId: `cus_${faker.string.alphanumeric(14)}` }
      });
      const blockedDomain = faker.internet.domainName().toLowerCase();
      const dseq = faker.string.numeric(8);

      await seedWalletSetting({ userId: user.id, walletId: wallet.id });
      await seedDeploymentSetting({ userId: user.id });
      await db.insert(resolveTable("ApiKeys")).values({ userId: user.id, hashedKey: faker.string.alphanumeric(64), keyFormat: "ac.sk", name: "ci" });
      await db
        .insert(resolveTable("EmailVerificationCodes"))
        .values({ userId: user.id, email: user.email ?? faker.internet.email(), code: "0".repeat(64), expiresAt: new Date() });
      await db
        .insert(resolveTable("PaymentMethods"))
        .values({ userId: user.id, fingerprint: faker.string.alphanumeric(16), paymentMethodId: `pm_${faker.string.alphanumeric(14)}` });
      await db.insert(resolveTable("StripeTransactions")).values({ userId: user.id, type: "payment_intent", amount: 1000 });
      await db.insert(resolveTable("HardwareRequests")).values({ userId: user.id, category: "other", contactEmail: faker.internet.email() });
      await db.insert(resolveTable("WorkloadAbuseDetections")).values({
        userId: user.id,
        walletId: wallet.id,
        dseq,
        provider: "akash1provider",
        verdict: "soft",
        probeStatus: "ok",
        signals: [],
        evidenceExcerpt: "xmrig"
      });
      await db
        .insert(resolveTable("WorkloadProbeEvidence"))
        .values({ walletId: wallet.id, dseq, provider: "akash1provider", service: "web", shellStatus: "ok", verdict: "clean" });
      await db.insert(resolveTable("BlockedEmailDomains")).values({ domain: blockedDomain, triggeredByUserId: user.id });
      const templateId = await templateRepository.upsert(null, user.userId!, templateInput());

      return { user, wallet, address, blockedDomain, templateId };
    }

    function templateInput() {
      return { title: faker.lorem.words(2), sdl: 'version: "2.0"', cpu: 1000, ram: 1024, storage: 1024 };
    }

    function answerActiveDeployments(owners: string[]) {
      const deployments = owners.map(owner => createDeploymentInfoSeed({ owner, state: "active" }));
      nock(restApiNodeUrl)
        .persist()
        .get(DEPLOYMENT_LIST_PATH)
        .query(true)
        .reply(200, { deployments, pagination: { next_key: null, total: String(deployments.length) } });
    }

    async function countRowsOwnedBy({ user, wallet }: Awaited<ReturnType<typeof seedAccount>>) {
      const count = async (table: PgTable, where: SQL) => {
        const [row] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(table)
          .where(where);
        return row.count;
      };

      return {
        users: await count(resolveTable("Users"), eq(resolveTable("Users").id, user.id)),
        userWallets: await count(resolveTable("UserWallets"), eq(resolveTable("UserWallets").userId, user.id)),
        walletSettings: await count(resolveTable("WalletSetting"), eq(resolveTable("WalletSetting").userId, user.id)),
        deploymentSettings: await count(resolveTable("DeploymentSettings"), eq(resolveTable("DeploymentSettings").userId, user.id)),
        apiKeys: await count(resolveTable("ApiKeys"), eq(resolveTable("ApiKeys").userId, user.id)),
        emailVerificationCodes: await count(resolveTable("EmailVerificationCodes"), eq(resolveTable("EmailVerificationCodes").userId, user.id)),
        paymentMethods: await count(resolveTable("PaymentMethods"), eq(resolveTable("PaymentMethods").userId, user.id)),
        stripeTransactions: await count(resolveTable("StripeTransactions"), eq(resolveTable("StripeTransactions").userId, user.id)),
        hardwareRequests: await count(resolveTable("HardwareRequests"), eq(resolveTable("HardwareRequests").userId, user.id)),
        workloadAbuseDetections: await count(resolveTable("WorkloadAbuseDetections"), eq(resolveTable("WorkloadAbuseDetections").userId, user.id)),
        workloadProbeEvidence: await count(resolveTable("WorkloadProbeEvidence"), eq(resolveTable("WorkloadProbeEvidence").walletId, wallet.id)),
        accountDeletionTokens: await count(resolveTable("AccountDeletionTokens"), eq(resolveTable("AccountDeletionTokens").userId, user.id)),
        templates: await count(resolveTable("Templates"), eq(resolveTable("Templates").userId, user.userId!)),
        templateFavorites: await count(resolveTable("TemplateFavorites"), eq(resolveTable("TemplateFavorites").userId, user.userId!))
      };
    }

    return { service: container.resolve(AccountDeletionService), db, account, bystander, token, answerActiveDeployments, countRowsOwnedBy };
  }
});
