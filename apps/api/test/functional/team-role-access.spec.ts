import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { type ApiPgDatabase, CORE_CONFIG, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import {
  seedOrganization,
  seedOrganizationInvitation,
  seedOrganizationMember,
  seedOrganizationWithOwner,
  seedProject,
  seedProjectMember
} from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { seedWalletSetting } from "@test/seeders/db/wallet-setting.seeder";
import { createDeploymentInfoErrorSeed, createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";

type Caller = OrganizationRole | "projectKey";

interface Team {
  organizationId: string;
  ownerUserId: string;
  paymentMethodId: string;
  defaultProjectId: string;
  grantedProjectId: string;
  otherProjectId: string;
  emptyProjectId: string;
  adminMembershipId: string;
  memberMembershipId: string;
  viewerMembershipId: string;
  viewerUserId: string;
  invitationId: string;
  grantedBudgetId: string;
  otherBudgetId: string;
  grantedDseq: string;
  otherDseq: string;
  transactionId: string;
}

interface TeamRequest {
  method: string;
  path: string;
  body?: unknown;
}

interface RouteAccess {
  route: string;
  request: (team: Team) => TeamRequest;
  statusFor: Record<Caller, number>;
}

const get = (path: string): TeamRequest => ({ method: "GET", path });
const post = (path: string, data?: unknown): TeamRequest => ({ method: "POST", path, body: data === undefined ? undefined : { data } });
const patch = (path: string, data: unknown): TeamRequest => ({ method: "PATCH", path, body: { data } });
const remove = (path: string): TeamRequest => ({ method: "DELETE", path });

const providerTokenFor = (dseq: string, scope: string[] = ["logs", "shell"]) => ({
  ttl: 60,
  leases: {
    access: "granular",
    permissions: [{ provider: createAkashAddress(), access: "granular", deployments: [{ dseq: Number(dseq), scope, services: ["web"] }] }]
  }
});

const READ_ONLY_SCOPE = ["status", "events", "logs"];

const MAX_ACKNOWLEDGED_FORFEIT_USD = 1_000_000;

const CALLERS: Caller[] = ["owner", "admin", "member", "billing", "viewer", "projectKey"];

const access = (owner: number, admin: number, member: number, billing: number, viewer: number, projectKey: number): Record<Caller, number> => ({
  owner,
  admin,
  member,
  billing,
  viewer,
  projectKey
});

const ROUTE_ACCESS: RouteAccess[] = [
  {
    route: "PATCH /v1/organizations/{id}",
    request: team => patch(`/v1/organizations/${team.organizationId}`, { name: "Renamed" }),
    statusFor: access(200, 200, 403, 403, 403, 403)
  },
  {
    route: "DELETE /v1/organizations/{id}",
    request: team => remove(`/v1/organizations/${team.organizationId}?acknowledgedForfeitUsd=${MAX_ACKNOWLEDGED_FORFEIT_USD}`),
    statusFor: access(204, 403, 403, 403, 403, 403)
  },
  {
    route: "GET /v1/user/me/deletion-eligibility",
    request: () => get("/v1/user/me/deletion-eligibility"),
    statusFor: access(200, 200, 200, 200, 200, 403)
  },
  { route: "GET /v1/organization-members", request: () => get("/v1/organization-members"), statusFor: access(200, 200, 200, 200, 200, 403) },
  {
    route: "PATCH /v1/organization-members/{id}",
    request: team => patch(`/v1/organization-members/${team.memberMembershipId}`, { role: "viewer" }),
    statusFor: access(200, 200, 403, 403, 403, 403)
  },
  {
    route: "DELETE /v1/organization-members/{id}",
    request: team => remove(`/v1/organization-members/${team.viewerMembershipId}`),
    statusFor: access(204, 204, 403, 403, 403, 403)
  },
  {
    route: "POST /v1/organization-members/{id}/ownership-transfer",
    request: team => post(`/v1/organization-members/${team.adminMembershipId}/ownership-transfer`),
    statusFor: access(200, 403, 403, 403, 403, 403)
  },
  { route: "GET /v1/organization-invitations", request: () => get("/v1/organization-invitations"), statusFor: access(200, 200, 403, 403, 403, 403) },
  {
    route: "POST /v1/organization-invitations",
    request: () => post("/v1/organization-invitations", { emails: [faker.internet.email()], role: "member" }),
    statusFor: access(201, 201, 403, 403, 403, 403)
  },
  {
    route: "DELETE /v1/organization-invitations/{id}",
    request: team => remove(`/v1/organization-invitations/${team.invitationId}`),
    statusFor: access(204, 204, 403, 403, 403, 403)
  },
  { route: "GET /v1/projects", request: () => get("/v1/projects"), statusFor: access(200, 200, 200, 200, 200, 200) },
  { route: "POST /v1/projects", request: () => post("/v1/projects", { name: faker.string.alpha(12) }), statusFor: access(201, 201, 403, 403, 403, 403) },
  {
    route: "GET /v1/projects/{id} of an ungranted project",
    request: team => get(`/v1/projects/${team.otherProjectId}`),
    statusFor: access(200, 200, 404, 200, 404, 404)
  },
  {
    route: "PATCH /v1/projects/{id}",
    request: team => patch(`/v1/projects/${team.grantedProjectId}`, { name: "Renamed" }),
    statusFor: access(200, 200, 403, 403, 403, 403)
  },
  { route: "DELETE /v1/projects/{id}", request: team => remove(`/v1/projects/${team.emptyProjectId}`), statusFor: access(204, 204, 403, 403, 403, 403) },
  {
    route: "GET /v1/projects/{id}/members",
    request: team => get(`/v1/projects/${team.grantedProjectId}/members`),
    statusFor: access(200, 200, 200, 403, 200, 403)
  },
  {
    route: "POST /v1/project-members",
    request: team => post("/v1/project-members", { projectId: team.otherProjectId, userId: team.viewerUserId, role: "viewer" }),
    statusFor: access(201, 201, 403, 403, 403, 403)
  },
  { route: "GET /v1/project-budgets", request: () => get("/v1/project-budgets"), statusFor: access(200, 200, 200, 200, 200, 200) },
  {
    route: "POST /v1/project-budgets",
    request: team => post("/v1/project-budgets", { projectId: team.defaultProjectId, monthlyAmountUsd: 10 }),
    statusFor: access(201, 201, 404, 403, 404, 404)
  },
  {
    route: "PATCH /v1/project-budgets/{id} of the key's project",
    request: team => patch(`/v1/project-budgets/${team.grantedBudgetId}`, { monthlyAmountUsd: 9000 }),
    statusFor: access(200, 200, 403, 403, 403, 200)
  },
  {
    route: "DELETE /v1/project-budgets/{id} of another project",
    request: team => remove(`/v1/project-budgets/${team.otherBudgetId}`),
    statusFor: access(204, 204, 403, 403, 403, 404)
  },
  { route: "GET /v1/api-keys", request: () => get("/v1/api-keys"), statusFor: access(200, 200, 200, 200, 200, 403) },
  { route: "POST /v1/api-keys", request: () => post("/v1/api-keys", { name: "ci" }), statusFor: access(201, 201, 201, 201, 201, 403) },
  { route: "GET /v1/organization-activities", request: () => get("/v1/organization-activities"), statusFor: access(200, 200, 200, 200, 200, 200) },
  { route: "GET /v1/project-spend", request: () => get("/v1/project-spend"), statusFor: access(200, 200, 200, 200, 200, 200) },
  { route: "GET /v1/wallets", request: team => get(`/v1/wallets?userId=${team.ownerUserId}`), statusFor: access(200, 200, 200, 200, 200, 200) },
  { route: "GET /v1/stripe/payment-methods", request: () => get("/v1/stripe/payment-methods"), statusFor: access(200, 200, 403, 200, 403, 403) },
  {
    route: "POST /v1/stripe/payment-methods/default",
    request: team => post("/v1/stripe/payment-methods/default", { id: team.paymentMethodId }),
    statusFor: access(200, 403, 403, 200, 403, 403)
  },
  { route: "GET /v1/wallet-settings", request: () => get("/v1/wallet-settings"), statusFor: access(200, 200, 200, 200, 200, 403) },
  { route: "DELETE /v1/wallet-settings", request: () => remove("/v1/wallet-settings"), statusFor: access(204, 403, 403, 204, 403, 403) },
  { route: "GET /v1/stripe/transactions", request: () => get("/v1/stripe/transactions"), statusFor: access(200, 200, 403, 200, 403, 403) },
  {
    route: "POST /v1/stripe/transactions/{id}/invoice",
    request: team => post(`/v1/stripe/transactions/${team.transactionId}/invoice`),
    statusFor: access(200, 200, 403, 200, 403, 403)
  },
  {
    route: "GET /v2/deployment-settings/{dseq} of the granted project",
    request: team => get(`/v2/deployment-settings/${team.grantedDseq}`),
    statusFor: access(200, 200, 200, 403, 200, 200)
  },
  {
    route: "GET /v2/deployment-settings/{dseq} of an ungranted project",
    request: team => get(`/v2/deployment-settings/${team.otherDseq}`),
    statusFor: access(200, 200, 404, 403, 404, 404)
  },
  {
    route: "PATCH /v2/deployment-settings/{dseq} of the granted project",
    request: team => patch(`/v2/deployment-settings/${team.grantedDseq}`, { autoTopUpEnabled: false }),
    statusFor: access(200, 200, 200, 403, 403, 200)
  },
  {
    route: "PATCH /v2/deployment-settings/{dseq} of an ungranted project",
    request: team => patch(`/v2/deployment-settings/${team.otherDseq}`, { autoTopUpEnabled: false }),
    statusFor: access(200, 200, 404, 403, 403, 404)
  },
  {
    route: "PATCH /v1/deployments/{dseq}/project",
    request: team => patch(`/v1/deployments/${team.grantedDseq}/project`, { projectId: team.otherProjectId }),
    statusFor: access(200, 200, 403, 403, 403, 404)
  },
  {
    route: "GET /v1/deployments/{dseq} of an ungranted project",
    request: team => get(`/v1/deployments/${team.otherDseq}`),
    statusFor: access(200, 200, 404, 403, 404, 404)
  },
  {
    route: "GET /v1/deployment-alerts/{dseq} of an ungranted project",
    request: team => get(`/v1/deployment-alerts/${team.otherDseq}`),
    statusFor: access(200, 200, 404, 403, 404, 404)
  },
  {
    route: "POST /v1/deployment-alerts/{dseq} of the granted project",
    request: team =>
      post(`/v1/deployment-alerts/${team.grantedDseq}`, { alerts: { deploymentClosed: { notificationChannelId: faker.string.uuid(), enabled: true } } }),
    statusFor: access(200, 200, 200, 403, 403, 200)
  },
  { route: "GET /v1/notification-channels", request: () => get("/v1/notification-channels"), statusFor: access(200, 200, 200, 403, 200, 200) },
  {
    route: "POST /v1/create-jwt-token for a deployment of the granted project",
    request: team => post("/v1/create-jwt-token", providerTokenFor(team.grantedDseq)),
    statusFor: access(201, 201, 201, 403, 403, 201)
  },
  {
    route: "POST /v1/create-jwt-token for a deployment of an ungranted project",
    request: team => post("/v1/create-jwt-token", providerTokenFor(team.otherDseq)),
    statusFor: access(201, 201, 403, 403, 403, 403)
  },
  {
    route: "POST /v1/create-jwt-token reading a deployment of the granted project",
    request: team => post("/v1/create-jwt-token", providerTokenFor(team.grantedDseq, READ_ONLY_SCOPE)),
    statusFor: access(201, 201, 201, 403, 201, 201)
  },
  {
    route: "POST /v1/create-jwt-token reading a deployment of an ungranted project",
    request: team => post("/v1/create-jwt-token", providerTokenFor(team.otherDseq, READ_ONLY_SCOPE)),
    statusFor: access(201, 201, 403, 403, 403, 403)
  }
];

const EVERY_PROJECT: Array<keyof Team> = ["defaultProjectId", "grantedProjectId", "otherProjectId", "emptyProjectId"];

const VISIBLE_PROJECTS: Array<{ caller: Caller; projects: Array<keyof Team> }> = [
  { caller: "owner", projects: EVERY_PROJECT },
  { caller: "admin", projects: EVERY_PROJECT },
  { caller: "member", projects: ["grantedProjectId"] },
  { caller: "billing", projects: EVERY_PROJECT },
  { caller: "viewer", projects: ["grantedProjectId"] },
  { caller: "projectKey", projects: ["grantedProjectId"] }
];

const VISIBLE_BUDGETS: Array<{ caller: Caller; budgets: Array<keyof Team> }> = [
  { caller: "owner", budgets: ["grantedBudgetId", "otherBudgetId"] },
  { caller: "admin", budgets: ["grantedBudgetId", "otherBudgetId"] },
  { caller: "member", budgets: [] },
  { caller: "billing", budgets: ["grantedBudgetId", "otherBudgetId"] },
  { caller: "viewer", budgets: [] },
  { caller: "projectKey", budgets: ["grantedBudgetId"] }
];

const ORGANIZATION_SPEND_READERS: Array<{ caller: Caller; seesTotal: boolean }> = CALLERS.map(caller => ({
  caller,
  seesTotal: ["owner", "admin", "billing"].includes(caller)
}));

describe("Team role access", () => {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);

  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe.each(CALLERS)("as the %s", caller => {
    it.each(ROUTE_ACCESS)("answers $statusFor." + caller + " to $route", async ({ request, statusFor }) => {
      const { team, send, credentialsOf } = await setup();

      const response = await send(request(team), credentialsOf(caller));

      expect(response.status).toBe(statusFor[caller]);
    });
  });

  it.each(VISIBLE_PROJECTS)("lists the projects the $caller reaches", async ({ caller, projects }) => {
    const { team, send, credentialsOf } = await setup();

    const response = await send(get("/v1/projects"), credentialsOf(caller));

    const { data } = (await response.json()) as { data: Array<{ id: string }> };
    expect(data.map(({ id }) => id).sort()).toEqual(projects.map(project => team[project]).sort());
  });

  it.each(VISIBLE_BUDGETS)("lists the budgets the $caller reaches", async ({ caller, budgets }) => {
    const { team, send, credentialsOf } = await setup();

    const response = await send(get("/v1/project-budgets"), credentialsOf(caller));

    const { data } = (await response.json()) as { data: Array<{ id: string }> };
    expect(data.map(({ id }) => id).sort()).toEqual(budgets.map(budget => team[budget]).sort());
  });

  it.each(ORGANIZATION_SPEND_READERS)("gives the $caller the organization's total spend: $seesTotal", async ({ caller, seesTotal }) => {
    const { send, credentialsOf } = await setup();

    const response = await send(get("/v1/project-spend"), credentialsOf(caller));

    const { data } = (await response.json()) as { data: { total: unknown } };
    expect(data.total !== null).toBe(seesTotal);
  });

  it("refuses its owner the deletion of a personal organization on its own", async () => {
    const { team, send, credentialsOf } = await setup();
    const personal = await seedOrganization({ type: "personal", createdByUserId: team.ownerUserId });
    await seedOrganizationMember({ organizationId: personal.id, userId: team.ownerUserId, role: "owner" });

    const response = await send(remove(`/v1/organizations/${personal.id}`), { ...credentialsOf("owner"), "x-organization-id": personal.id });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "personal_organization" });
  });

  async function seedTeam(sessions: Map<string, string>) {
    const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
    const { user: owner, organization, project: defaultProject } = await seedOrganizationWithOwner({ stripeCustomerId, user: { userId: faker.string.uuid() } });
    const [grantedProject, otherProject, emptyProject] = await Promise.all([
      seedProject({ organizationId: organization.id, name: "Granted", createdByUserId: owner.id }),
      seedProject({ organizationId: organization.id, name: "Other", createdByUserId: owner.id }),
      seedProject({ organizationId: organization.id, name: "Empty", createdByUserId: owner.id })
    ]);
    const [admin, member, billing, viewer] = await Promise.all([seedSignedUpUser(), seedSignedUpUser(), seedSignedUpUser(), seedSignedUpUser()]);
    const [adminMembership, memberMembership, , viewerMembership] = await Promise.all([
      seedOrganizationMember({ organizationId: organization.id, userId: admin.id, role: "admin" }),
      seedOrganizationMember({ organizationId: organization.id, userId: member.id, role: "member" }),
      seedOrganizationMember({ organizationId: organization.id, userId: billing.id, role: "billing" }),
      seedOrganizationMember({ organizationId: organization.id, userId: viewer.id, role: "viewer" })
    ]);
    await Promise.all([
      seedProjectMember({ organizationId: organization.id, projectId: grantedProject.id, userId: member.id, role: "member" }),
      seedProjectMember({ organizationId: organization.id, projectId: grantedProject.id, userId: viewer.id, role: "viewer" })
    ]);
    const invitation = await seedOrganizationInvitation({ organizationId: organization.id, invitedByUserId: owner.id });
    const [grantedBudget, otherBudget] = await db
      .insert(resolveTable("ProjectBudgets"))
      .values([
        { organizationId: organization.id, projectId: grantedProject.id, monthlyAmountCents: 5000 },
        { organizationId: organization.id, projectId: otherProject.id, monthlyAmountCents: 5000 }
      ])
      .returning();
    const [wallet] = await db
      .insert(resolveTable("UserWallets"))
      .values({ userId: null, organizationId: organization.id, address: createAkashAddress(), isTrialing: false, activatedAt: new Date() })
      .returning();
    await seedWalletSetting({ userId: owner.id, walletId: wallet.id, organizationId: organization.id });
    const [grantedDseq, otherDseq] = [
      faker.string.numeric({ length: 14, allowLeadingZeros: false }),
      faker.string.numeric({ length: 14, allowLeadingZeros: false })
    ];
    await Promise.all([
      seedDeploymentSetting({ userId: owner.id, dseq: grantedDseq, organizationId: organization.id, projectId: grantedProject.id }),
      seedDeploymentSetting({ userId: owner.id, dseq: otherDseq, organizationId: organization.id, projectId: otherProject.id })
    ]);
    const transaction = await seedPaidCardPayment(owner.id, organization.id);
    const projectKey = await seedApiKey({ userId: owner.id, organizationId: organization.id, projectId: grantedProject.id });
    answerDeploymentsOnChain(wallet.address as string, [grantedDseq, otherDseq]);
    const paymentMethodId = answerCardOnStripe(stripeCustomerId);

    const team: Team = {
      organizationId: organization.id,
      ownerUserId: owner.id,
      paymentMethodId,
      defaultProjectId: defaultProject.id,
      grantedProjectId: grantedProject.id,
      otherProjectId: otherProject.id,
      emptyProjectId: emptyProject.id,
      adminMembershipId: adminMembership.id,
      memberMembershipId: memberMembership.id,
      viewerMembershipId: viewerMembership.id,
      viewerUserId: viewer.id,
      invitationId: invitation.id,
      grantedBudgetId: grantedBudget.id,
      otherBudgetId: otherBudget.id,
      grantedDseq,
      otherDseq,
      transactionId: transaction.id
    };
    const sessionOf = (user: { userId: string | null }) => ({ ...signIn(user.userId!, sessions), "x-organization-id": organization.id });
    const credentials: Record<Caller, Record<string, string>> = {
      owner: sessionOf(owner),
      admin: sessionOf(admin),
      member: sessionOf(member),
      billing: sessionOf(billing),
      viewer: sessionOf(viewer),
      projectKey: { "x-api-key": projectKey }
    };

    return { team, credentials };
  }

  async function seedSignedUpUser() {
    return await seedUser({ userId: faker.string.uuid() });
  }

  async function seedPaidCardPayment(userId: string, organizationId: string) {
    const stripeInvoiceId = `in_${faker.string.alphanumeric(14)}`;
    const [transaction] = await db
      .insert(resolveTable("StripeTransactions"))
      .values({ userId, organizationId, type: "payment_intent", status: "succeeded", amount: 2500, currency: "usd", stripeInvoiceId })
      .returning();
    nock("https://api.stripe.com")
      .persist()
      .get(`/v1/invoices/${stripeInvoiceId}`)
      .reply(200, { id: stripeInvoiceId, object: "invoice", status: "paid", invoice_pdf: "https://pay.stripe.com/invoice" });

    return transaction;
  }

  function answerCardOnStripe(stripeCustomerId: string) {
    const card = {
      id: `pm_${faker.string.alphanumeric(24)}`,
      object: "payment_method",
      type: "card",
      created: 1_700_000_000,
      customer: stripeCustomerId,
      card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030, fingerprint: faker.string.alphanumeric(16) }
    };
    nock("https://api.stripe.com")
      .persist()
      .get(`/v1/payment_methods/${card.id}`)
      .reply(200, card)
      .get(uri => uri.startsWith("/v1/payment_methods?"))
      .reply(200, { object: "list", data: [card], has_more: false, url: "/v1/payment_methods" });

    return card.id;
  }

  async function seedApiKey(input: { userId: string; organizationId: string; projectId: string }) {
    const generator = container.resolve(ApiKeyGeneratorService);
    const secret = generator.generateApiKey();
    await container.resolve(ApiKeyRepository).create({
      ...input,
      name: faker.word.noun(),
      hashedKey: generator.hashApiKeySha256(secret),
      keyFormat: generator.obfuscateApiKey(secret)
    });

    return secret;
  }

  function signIn(externalUserId: string, sessions: Map<string, string>) {
    const token = faker.string.alphanumeric(40);
    sessions.set(token, externalUserId);

    return { authorization: `Bearer ${token}` };
  }

  function answerDeploymentsOnChain(owner: string, dseqs: string[]) {
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(uri => uri.includes("/deployments/info"))
      .reply(uri => {
        const query = new URL(uri, "http://chain").searchParams;
        const dseq = query.get("id.dseq") ?? "";

        return query.get("id.owner") === owner && dseqs.includes(dseq)
          ? [200, createDeploymentInfoSeed({ owner, dseq })]
          : [404, createDeploymentInfoErrorSeed()];
      })
      .get(uri => uri.includes("/leases/list"))
      .reply(200, { leases: [], pagination: { next_key: null, total: "0" } })
      .get(uri => uri.includes("/deployments/list"))
      .reply(200, { deployments: [], pagination: { next_key: null, total: "0" } })
      .get(uri => uri.includes("/cosmos/authz/v1beta1/grants"))
      .reply(200, { grants: [], pagination: { next_key: null, total: "0" } });
  }

  function answerNotifications() {
    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
      .persist()
      .get(() => true)
      .reply(200, { data: [] })
      .post(() => true)
      .reply(200, { data: {} });
  }

  async function setup() {
    const sessions = new Map<string, string>();
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => sessions.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => flag !== FeatureFlags.ORGANIZATIONS_ENFORCE);
    answerNotifications();

    const { team, credentials } = await seedTeam(sessions);

    const send = async ({ method, path, body }: TeamRequest, headers: Record<string, string>) =>
      await app.request(path, {
        method,
        headers: body === undefined ? headers : { ...headers, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });

    return { team, send, credentialsOf: (caller: Caller) => credentials[caller] };
  }
});
