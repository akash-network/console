import { faker } from "@faker-js/faker";
import { createHash } from "crypto";
import { addMinutes } from "date-fns";
import { eq, inArray, type SQL, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import nock from "nock";
import { setTimeout as delay } from "node:timers/promises";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { OrganizationMemberService } from "@src/organization/services/organization-member/organization-member.service";
import { PersonalOrganizationService } from "@src/organization/services/personal-organization/personal-organization.service";
import { AccountDeletionTokenRepository } from "@src/user/repositories/account-deletion-token/account-deletion-token.repository";
import { UserTemplateRepository } from "@src/user/repositories/user-template/user-template.repository";
import { PurgeDeletedAccount, PurgeDeletedAccountHandler } from "@src/user/services/purge-deleted-account/purge-deleted-account.handler";
import { AccountDeletionService } from "./account-deletion.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { findDeploymentDeposit, seedDeploymentDeposit } from "@test/seeders/db/deployment-deposit.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { seedWalletSetting } from "@test/seeders/db/wallet-setting.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const DEPLOYMENT_LIST_PATH = "/akash/deployment/v1beta4/deployments/list";

type SeededTeam = Awaited<ReturnType<typeof seedOrganizationWithOwner>>;

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
      templateFavorites: 0,
      organizations: 0,
      organizationMembers: 0,
      projects: 0
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
      templateFavorites: 0,
      organizations: 1,
      organizationMembers: 1,
      projects: 1
    });
    const [blockedDomain] = await db
      .select()
      .from(resolveTable("BlockedEmailDomains"))
      .where(eq(resolveTable("BlockedEmailDomains").domain, account.blockedDomain));
    expect(blockedDomain.triggeredByUserId).toBeNull();
  });

  it("keeps the account's wallet row without an owner, so its derivation index and address stay on record", async () => {
    const { service, db, account, token, answerActiveDeployments } = await setup();
    answerActiveDeployments([]);

    await service.confirm({ token });

    const wallets = await db
      .select()
      .from(resolveTable("UserWallets"))
      .where(eq(resolveTable("UserWallets").id, account.wallet.id));
    expect(wallets).toEqual([expect.objectContaining({ id: account.wallet.id, address: account.address, userId: null, organizationId: null })]);
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
      personalOrganizationId: account.organization.id,
      version: 1
    });
  });

  it("keeps what the account wrote for a team organization without naming it, and erases what it wrote for itself", async () => {
    const { service, account, token, answerActiveDeployments, joinTeam, findRows } = await setup();
    answerActiveDeployments([]);
    const team = await joinTeam("billing");
    const accountRows = await team.seedRowsWrittenBy(account.user.id, { withWalletSetting: true });
    const ownerRows = await team.seedRowsWrittenBy(team.owner.id, { withWalletSetting: false });

    await service.confirm({ token });

    expect(await findRows(accountRows)).toEqual({
      stripeTransactions: [expect.objectContaining({ userId: null, organizationId: team.organization.id })],
      paymentMethods: [expect.objectContaining({ userId: null, organizationId: team.organization.id })],
      walletSettings: [expect.objectContaining({ userId: null, organizationId: team.organization.id })],
      deploymentSettings: [expect.objectContaining({ userId: null, organizationId: team.organization.id })]
    });
    expect(await findRows(ownerRows)).toEqual({
      stripeTransactions: [expect.objectContaining({ userId: team.owner.id })],
      paymentMethods: [expect.objectContaining({ userId: team.owner.id })],
      walletSettings: [],
      deploymentSettings: [expect.objectContaining({ userId: team.owner.id })]
    });
    expect(await team.memberCount()).toBe(1);
  });

  it("erases every row the account wrote for its personal organization rather than keeping it unnamed", async () => {
    const { service, account, token, answerActiveDeployments, joinTeam, countRowsFiledUnder, seedUnfiledRowsOf, findRows } = await setup();
    answerActiveDeployments([]);
    await joinTeam("member");
    const unfiledRows = await seedUnfiledRowsOf(account.user.id);

    await service.confirm({ token });

    expect(await countRowsFiledUnder(account.organization.id)).toEqual({ stripeTransactions: 0, paymentMethods: 0, walletSettings: 0, deploymentSettings: 0 });
    expect(await findRows(unfiledRows)).toEqual({ stripeTransactions: [], paymentMethods: [], walletSettings: [], deploymentSettings: [] });
  });

  it("lets an owner delete their account while another owner keeps the team", async () => {
    const { service, account, token, answerActiveDeployments, joinTeam, countRowsOwnedBy } = await setup();
    answerActiveDeployments([]);
    const team = await joinTeam("owner");

    await service.confirm({ token });

    expect(await countRowsOwnedBy(account)).toMatchObject({ users: 0 });
    expect(await team.memberCount()).toBe(1);
  });

  it("leaves the team one owner when an owner deletes their account while the other owner steps down", async () => {
    const { service, token, answerActiveDeployments, joinTeam } = await setup();
    answerActiveDeployments([]);
    const team = await joinTeam("owner");
    const memberRepository = container.resolve(OrganizationMemberRepository);

    const outcomes = await Promise.allSettled([
      container.resolve(TxService).transaction(async () => {
        await container.resolve(OrganizationMemberService).assertAnotherOwnerRemains(team.organization.id, team.owner.id);
        await delay(200);
        await memberRepository.updateBy({ organizationId: team.organization.id, userId: team.owner.id }, { role: "admin" });
      }),
      service.confirm({ token })
    ]);

    expect(outcomes.map(outcome => outcome.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(await memberRepository.count({ organizationId: team.organization.id, role: "owner" })).toBe(1);
  });

  it("refuses the last owner of a team organization before erasing anything", async () => {
    const { service, account, token, answerActiveDeployments, countRowsOwnedBy, ownTeam, findRows } = await setup();
    answerActiveDeployments([]);
    const team = await ownTeam();
    const accountRows = await team.seedRowsWrittenBy(account.user.id, { withWalletSetting: true });
    const before = await countRowsOwnedBy(account);

    await expect(service.confirm({ token })).rejects.toMatchObject({
      status: 409,
      errorCode: "last_owner",
      data: { organizations: [{ id: team.organization.id, name: team.organization.name }] }
    });

    expect(await countRowsOwnedBy(account)).toEqual(before);
    expect(await findRows(accountRows)).toEqual({
      stripeTransactions: [expect.objectContaining({ userId: account.user.id })],
      paymentMethods: [expect.objectContaining({ userId: account.user.id })],
      walletSettings: [expect.objectContaining({ userId: account.user.id })],
      deploymentSettings: [expect.objectContaining({ userId: account.user.id })]
    });
    expect(await findJobRows(PurgeDeletedAccount[JOB_NAME], { data: { userId: account.user.id } })).toHaveLength(0);
  });

  it("erases the deposit records of the personal organization and keeps the ones the account made in a team, without naming it", async () => {
    const { service, account, token, answerActiveDeployments } = await setup();
    const { organization: team } = await seedOrganizationWithOwner();
    await seedOrganizationMember({ organizationId: team.id, userId: account.user.id, role: "member" });
    const personalDeposit = await seedDeploymentDeposit({ organizationId: account.organization.id, actorUserId: account.user.id });
    const teamDeposit = await seedDeploymentDeposit({ organizationId: team.id, actorUserId: account.user.id });
    answerActiveDeployments([]);

    await service.confirm({ token });

    expect(await findDeploymentDeposit(personalDeposit.id)).toBeUndefined();
    expect(await findDeploymentDeposit(teamDeposit.id)).toMatchObject({ organizationId: team.id, actorUserId: null, amountCents: teamDeposit.amountCents });
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
    const personalOrganizationService = container.resolve(PersonalOrganizationService);
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

      const organization = await personalOrganizationService.ensureForUser(user);
      await personalOrganizationService.adoptUserRows(user, organization);

      return { user, wallet, address, blockedDomain, templateId, organization };
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

    async function countRowsOwnedBy({ user, wallet, organization }: Awaited<ReturnType<typeof seedAccount>>) {
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
        templateFavorites: await count(resolveTable("TemplateFavorites"), eq(resolveTable("TemplateFavorites").userId, user.userId!)),
        organizations: await count(resolveTable("Organizations"), eq(resolveTable("Organizations").id, organization.id)),
        organizationMembers: await count(resolveTable("OrganizationMembers"), eq(resolveTable("OrganizationMembers").organizationId, organization.id)),
        projects: await count(resolveTable("Projects"), eq(resolveTable("Projects").organizationId, organization.id))
      };
    }

    async function joinTeam(role: OrganizationRole) {
      const team = await seedTeam();
      await seedOrganizationMember({ organizationId: team.organization.id, userId: account.user.id, role });

      return team;
    }

    async function ownTeam() {
      const {
        user: owner,
        organization,
        project
      } = await seedOrganizationWithOwner({ user: { userId: faker.string.uuid() }, createdByUserId: account.user.id });
      await db.delete(resolveTable("OrganizationMembers")).where(eq(resolveTable("OrganizationMembers").userId, owner.id));
      await seedOrganizationMember({ organizationId: organization.id, userId: account.user.id, role: "owner" });

      return await teamRowsSeeder({ owner, organization, project });
    }

    async function seedTeam() {
      const { user: owner, organization, project } = await seedOrganizationWithOwner({ user: { userId: faker.string.uuid() } });

      return await teamRowsSeeder({ owner, organization, project });
    }

    async function teamRowsSeeder(team: { owner: SeededTeam["user"]; organization: SeededTeam["organization"]; project: SeededTeam["project"] }) {
      const [wallet] = await db
        .insert(resolveTable("UserWallets"))
        .values({ userId: null, organizationId: team.organization.id, address: createAkashAddress(), isTrialing: false })
        .returning();
      const organizationId = team.organization.id;

      async function seedRowsWrittenBy(userId: string, { withWalletSetting }: { withWalletSetting: boolean }) {
        const [transaction] = await db
          .insert(resolveTable("StripeTransactions"))
          .values({ userId, organizationId, type: "payment_intent", amount: 2500 })
          .returning();
        const [paymentMethod] = await db
          .insert(resolveTable("PaymentMethods"))
          .values({ userId, organizationId, fingerprint: faker.string.alphanumeric(16), paymentMethodId: `pm_${faker.string.alphanumeric(14)}` })
          .returning();
        const walletSetting = withWalletSetting ? await seedWalletSetting({ userId, walletId: wallet.id, organizationId }) : undefined;
        const deploymentSetting = await seedDeploymentSetting({ userId, organizationId, projectId: team.project.id });

        return {
          stripeTransactionIds: [transaction.id],
          paymentMethodIds: [paymentMethod.id],
          walletSettingIds: walletSetting ? [walletSetting.id] : [],
          deploymentSettingIds: [deploymentSetting.id]
        };
      }

      async function memberCount() {
        return await count(resolveTable("OrganizationMembers"), eq(resolveTable("OrganizationMembers").organizationId, organizationId));
      }

      return { ...team, wallet, seedRowsWrittenBy, memberCount };
    }

    async function findRows(ids: Awaited<ReturnType<Awaited<ReturnType<typeof seedTeam>>["seedRowsWrittenBy"]>>) {
      return {
        stripeTransactions: await rowsOf(resolveTable("StripeTransactions"), ids.stripeTransactionIds),
        paymentMethods: await rowsOf(resolveTable("PaymentMethods"), ids.paymentMethodIds),
        walletSettings: await rowsOf(resolveTable("WalletSetting"), ids.walletSettingIds),
        deploymentSettings: await rowsOf(resolveTable("DeploymentSettings"), ids.deploymentSettingIds)
      };
    }

    async function seedUnfiledRowsOf(userId: string) {
      const [transaction] = await db
        .insert(resolveTable("StripeTransactions"))
        .values({ userId, organizationId: null, type: "payment_intent", amount: 2500 })
        .returning();
      const [paymentMethod] = await db
        .insert(resolveTable("PaymentMethods"))
        .values({ userId, organizationId: null, fingerprint: faker.string.alphanumeric(16), paymentMethodId: `pm_${faker.string.alphanumeric(14)}` })
        .returning();
      const deploymentSetting = await seedDeploymentSetting({ userId, organizationId: null });

      return {
        stripeTransactionIds: [transaction.id],
        paymentMethodIds: [paymentMethod.id],
        walletSettingIds: [],
        deploymentSettingIds: [deploymentSetting.id]
      };
    }

    async function rowsOf(table: PgTable & { id: PgColumn }, ids: string[]) {
      return ids.length ? await db.select().from(table).where(inArray(table.id, ids)) : [];
    }

    async function countRowsFiledUnder(organizationId: string) {
      return {
        stripeTransactions: await count(resolveTable("StripeTransactions"), eq(resolveTable("StripeTransactions").organizationId, organizationId)),
        paymentMethods: await count(resolveTable("PaymentMethods"), eq(resolveTable("PaymentMethods").organizationId, organizationId)),
        walletSettings: await count(resolveTable("WalletSetting"), eq(resolveTable("WalletSetting").organizationId, organizationId)),
        deploymentSettings: await count(resolveTable("DeploymentSettings"), eq(resolveTable("DeploymentSettings").organizationId, organizationId))
      };
    }

    async function count(table: PgTable, where: SQL) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(table)
        .where(where);
      return row.count;
    }

    return {
      service: container.resolve(AccountDeletionService),
      db,
      account,
      bystander,
      token,
      answerActiveDeployments,
      countRowsOwnedBy,
      joinTeam,
      ownTeam,
      findRows,
      countRowsFiledUnder,
      seedUnfiledRowsOf
    };
  }
});
