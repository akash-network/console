import { MsgCloseDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Registry } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";
import fs from "fs";
import nock from "nock";
import path from "path";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { BILLING_CONFIG } from "@src/billing/providers";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import { type ApiPgDatabase, CORE_CONFIG, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { app } from "@src/rest-app";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import {
  seedOrganizationActivity,
  seedOrganizationInvitation,
  seedOrganizationMember,
  seedOrganizationWithOwner,
  seedProject,
  seedProjectMember
} from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { seedWalletSetting } from "@test/seeders/db/wallet-setting.seeder";
import { createDeploymentGrantResponseSeed } from "@test/seeders/deployment-grant-response.seeder";
import { createDeploymentInfoErrorSeed, createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createFeeAllowanceResponse } from "@test/seeders/fee-allowance-response.seeder";

interface TeamIds {
  organizationId: string;
  slug: string;
  ownerUserId: string;
  adminMembershipId: string;
  memberMembershipId: string;
  viewerUserId: string;
  invitationId: string;
  grantedProjectId: string;
  otherProjectId: string;
  projectGrantId: string;
  budgetId: string;
  ownerKeyId: string;
  grantedDseq: string;
  walletAddress: string;
  transactionId: string;
  paymentIntentId: string;
  paymentMethodId: string;
  templateId: string;
}

interface TeamRequest {
  method: string;
  path: string;
  body?: unknown;
}

interface RouteNamingAnotherTeam {
  route: string;
  status: number;
  ownerStatus: number;
  request: (team: TeamIds, ownTeam: TeamIds) => TeamRequest;
  echoes?: Array<keyof TeamIds>;
}

const get = (path: string): TeamRequest => ({ method: "GET", path });
const post = (path: string, data?: unknown): TeamRequest => ({ method: "POST", path, body: data === undefined ? undefined : { data } });
const postUnwrapped = (path: string, body: unknown): TeamRequest => ({ method: "POST", path, body });
const put = (path: string, data: unknown): TeamRequest => ({ method: "PUT", path, body: { data } });
const patch = (path: string, data: unknown): TeamRequest => ({ method: "PATCH", path, body: { data } });
const remove = (path: string): TeamRequest => ({ method: "DELETE", path });

const SDL = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

const templateOf = (team: TeamIds) => ({ id: team.templateId, sdl: SDL, title: "Taken", cpu: 100, ram: 100, storage: 100, isPublic: false });

const closeMessageOf = (team: TeamIds) => {
  const message = {
    typeUrl: `/${MsgCloseDeployment.$type}`,
    value: MsgCloseDeployment.fromPartial({ id: { owner: team.walletAddress, dseq: Number(team.grantedDseq) } })
  };

  return { typeUrl: message.typeUrl, value: Buffer.from(container.resolve<Registry>(TYPE_REGISTRY).encode(message)).toString("base64") };
};

const ROUTES_NAMING_ANOTHER_TEAM: RouteNamingAnotherTeam[] = [
  {
    route: "PATCH /v1/organizations/{id}",
    status: 404,
    ownerStatus: 200,
    request: team => patch(`/v1/organizations/${team.organizationId}`, { name: "Taken" })
  },
  {
    route: "PATCH /v1/organization-members/{id}",
    status: 404,
    ownerStatus: 200,
    request: team => patch(`/v1/organization-members/${team.memberMembershipId}`, { role: "owner" })
  },
  {
    route: "DELETE /v1/organization-members/{id}",
    status: 404,
    ownerStatus: 204,
    request: team => remove(`/v1/organization-members/${team.memberMembershipId}`)
  },
  {
    route: "POST /v1/organization-members/{id}/ownership-transfer",
    status: 404,
    ownerStatus: 200,
    request: team => post(`/v1/organization-members/${team.adminMembershipId}/ownership-transfer`)
  },
  {
    route: "POST /v1/organization-invitations granting a project",
    status: 400,
    ownerStatus: 201,
    request: team =>
      post("/v1/organization-invitations", {
        emails: [faker.internet.email()],
        role: "member",
        projectGrants: [{ projectId: team.grantedProjectId, role: "admin" }]
      })
  },
  {
    route: "POST /v1/organization-invitations/{id}/resend",
    status: 404,
    ownerStatus: 200,
    request: team => post(`/v1/organization-invitations/${team.invitationId}/resend`)
  },
  {
    route: "POST /v1/organization-invitations/{id}/link",
    status: 404,
    ownerStatus: 200,
    request: team => post(`/v1/organization-invitations/${team.invitationId}/link`)
  },
  {
    route: "DELETE /v1/organization-invitations/{id}",
    status: 404,
    ownerStatus: 204,
    request: team => remove(`/v1/organization-invitations/${team.invitationId}`)
  },
  { route: "GET /v1/projects/{id}", status: 404, ownerStatus: 200, request: team => get(`/v1/projects/${team.grantedProjectId}`) },
  { route: "PATCH /v1/projects/{id}", status: 404, ownerStatus: 200, request: team => patch(`/v1/projects/${team.grantedProjectId}`, { name: "Taken" }) },
  { route: "DELETE /v1/projects/{id}", status: 404, ownerStatus: 204, request: team => remove(`/v1/projects/${team.otherProjectId}`) },
  { route: "GET /v1/projects/{id}/members", status: 404, ownerStatus: 200, request: team => get(`/v1/projects/${team.grantedProjectId}/members`) },
  {
    route: "POST /v1/project-members",
    status: 404,
    ownerStatus: 201,
    request: team => post("/v1/project-members", { projectId: team.otherProjectId, userId: team.viewerUserId, role: "viewer" })
  },
  {
    route: "PATCH /v1/project-members/{id}",
    status: 404,
    ownerStatus: 200,
    request: team => patch(`/v1/project-members/${team.projectGrantId}`, { role: "admin" })
  },
  { route: "DELETE /v1/project-members/{id}", status: 404, ownerStatus: 204, request: team => remove(`/v1/project-members/${team.projectGrantId}`) },
  {
    route: "POST /v1/project-budgets",
    status: 404,
    ownerStatus: 201,
    request: team => post("/v1/project-budgets", { projectId: team.otherProjectId, monthlyAmountUsd: 10 })
  },
  {
    route: "PATCH /v1/project-budgets/{id}",
    status: 404,
    ownerStatus: 200,
    request: team => patch(`/v1/project-budgets/${team.budgetId}`, { monthlyAmountUsd: 9000 })
  },
  { route: "DELETE /v1/project-budgets/{id}", status: 404, ownerStatus: 204, request: team => remove(`/v1/project-budgets/${team.budgetId}`) },
  {
    route: "POST /v1/api-keys bound to a project",
    status: 404,
    ownerStatus: 201,
    request: team => post("/v1/api-keys", { name: "ci", projectId: team.grantedProjectId })
  },
  { route: "GET /v1/api-keys/{id}", status: 404, ownerStatus: 200, request: team => get(`/v1/api-keys/${team.ownerKeyId}`) },
  { route: "PATCH /v1/api-keys/{id}", status: 404, ownerStatus: 200, request: team => patch(`/v1/api-keys/${team.ownerKeyId}`, { name: "Taken" }) },
  { route: "DELETE /v1/api-keys/{id}", status: 204, ownerStatus: 204, request: team => remove(`/v1/api-keys/${team.ownerKeyId}`) },
  {
    route: "GET /v1/deployment-settings/{userId}/{dseq}",
    status: 404,
    ownerStatus: 200,
    request: team => get(`/v1/deployment-settings/${team.ownerUserId}/${team.grantedDseq}`)
  },
  { route: "GET /v2/deployment-settings/{dseq}", status: 404, ownerStatus: 200, request: team => get(`/v2/deployment-settings/${team.grantedDseq}`) },
  {
    route: "POST /v1/deployment-settings filing a deployment of the team under its owner",
    status: 409,
    ownerStatus: 201,
    request: team => post("/v1/deployment-settings", { userId: team.ownerUserId, dseq: team.grantedDseq })
  },
  {
    route: "PATCH /v1/deployment-settings/{userId}/{dseq}",
    status: 404,
    ownerStatus: 200,
    request: team => patch(`/v1/deployment-settings/${team.ownerUserId}/${team.grantedDseq}`, { closeReason: "no_longer_needed" })
  },
  {
    route: "POST /v2/deployment-settings filing a dseq of the team in the caller's own team",
    status: 201,
    ownerStatus: 201,
    request: team => post("/v2/deployment-settings", { dseq: team.grantedDseq }),
    echoes: ["grantedDseq"]
  },
  {
    route: "PATCH /v2/deployment-settings/{dseq} filing a dseq of the team in the caller's own team",
    status: 200,
    ownerStatus: 200,
    request: team => patch(`/v2/deployment-settings/${team.grantedDseq}`, { autoTopUpEnabled: false }),
    echoes: ["grantedDseq"]
  },
  {
    route: "PATCH /v1/deployments/{dseq}/project moving a deployment of the team",
    status: 404,
    ownerStatus: 200,
    request: (team, ownTeam) => patch(`/v1/deployments/${team.grantedDseq}/project`, { projectId: ownTeam.otherProjectId })
  },
  {
    route: "PATCH /v1/deployments/{dseq}/project moving a deployment into the team",
    status: 404,
    ownerStatus: 200,
    request: (team, ownTeam) => patch(`/v1/deployments/${ownTeam.grantedDseq}/project`, { projectId: team.otherProjectId })
  },
  { route: "GET /v1/deployment-locations/{dseq}", status: 404, ownerStatus: 200, request: team => get(`/v1/deployment-locations/${team.grantedDseq}`) },
  { route: "GET /v1/deployments/{dseq}", status: 404, ownerStatus: 200, request: team => get(`/v1/deployments/${team.grantedDseq}`) },
  {
    route: "POST /v1/deployments filing into a project of the team",
    status: 404,
    ownerStatus: 201,
    request: team => post("/v1/deployments", { sdl: SDL, projectId: team.otherProjectId })
  },
  {
    route: "POST /v1/deployments inheriting the secrets of a deployment of the team",
    status: 404,
    ownerStatus: 201,
    request: team => post("/v1/deployments", { sdl: SDL, inheritSecretsFrom: team.grantedDseq })
  },
  {
    route: "POST /v1/tx signing as the team's owner to close its deployment",
    status: 404,
    ownerStatus: 200,
    request: team => post("/v1/tx", { userId: team.ownerUserId, messages: [closeMessageOf(team)] })
  },
  { route: "PATCH /v1/deployments/{dseq}", status: 404, ownerStatus: 200, request: team => patch(`/v1/deployments/${team.grantedDseq}`, { name: "Taken" }) },
  { route: "PUT /v1/deployments/{dseq}", status: 404, ownerStatus: 422, request: team => put(`/v1/deployments/${team.grantedDseq}`, { sdl: SDL }) },
  {
    route: "POST /v1/deployments/{dseq}/definition",
    status: 404,
    ownerStatus: 422,
    request: team => post(`/v1/deployments/${team.grantedDseq}/definition`, { sdl: SDL })
  },
  { route: "DELETE /v1/deployments/{dseq}", status: 404, ownerStatus: 200, request: team => remove(`/v1/deployments/${team.grantedDseq}`) },
  {
    route: "POST /v1/deposit-deployment",
    status: 404,
    ownerStatus: 200,
    request: team => post("/v1/deposit-deployment", { dseq: team.grantedDseq, deposit: 5 })
  },
  {
    route: "POST /v1/stripe/transactions/{id}/invoice",
    status: 404,
    ownerStatus: 200,
    request: team => post(`/v1/stripe/transactions/${team.transactionId}/invoice`)
  },
  {
    route: "POST /v1/stripe/transactions/confirm charging a card of the team",
    status: 403,
    ownerStatus: 202,
    request: team => post("/v1/stripe/transactions/confirm", { userId: team.ownerUserId, paymentMethodId: team.paymentMethodId, amount: 20 })
  },
  {
    route: "POST /v1/stripe/payment-methods/default",
    status: 404,
    ownerStatus: 200,
    request: team => post("/v1/stripe/payment-methods/default", { id: team.paymentMethodId })
  },
  {
    route: "POST /v1/stripe/payment-methods/validate",
    status: 403,
    ownerStatus: 200,
    request: team => post("/v1/stripe/payment-methods/validate", { paymentMethodId: team.paymentMethodId, paymentIntentId: team.paymentIntentId })
  },
  {
    route: "DELETE /v1/stripe/payment-methods/{id}",
    status: 403,
    ownerStatus: 204,
    request: team => remove(`/v1/stripe/payment-methods/${team.paymentMethodId}`)
  },
  { route: "GET /v1/user/template/{id}", status: 404, ownerStatus: 200, request: team => get(`/v1/user/template/${team.templateId}`) },
  { route: "POST /v1/user/saveTemplate", status: 200, ownerStatus: 200, request: team => postUnwrapped("/v1/user/saveTemplate", templateOf(team)) },
  {
    route: "POST /v1/user/saveTemplateDesc",
    status: 204,
    ownerStatus: 204,
    request: team => postUnwrapped("/v1/user/saveTemplateDesc", { id: team.templateId, description: "Taken" })
  },
  { route: "DELETE /v1/user/deleteTemplate/{id}", status: 204, ownerStatus: 204, request: team => remove(`/v1/user/deleteTemplate/${team.templateId}`) },
  {
    route: "POST /v1/user/addFavoriteTemplate/{templateId}",
    status: 204,
    ownerStatus: 204,
    request: team => post(`/v1/user/addFavoriteTemplate/${team.templateId}`)
  },
  {
    route: "DELETE /v1/user/removeFavoriteTemplate/{templateId}",
    status: 204,
    ownerStatus: 204,
    request: team => remove(`/v1/user/removeFavoriteTemplate/${team.templateId}`)
  }
];

const READS_OF_THE_OWN_TEAM: Array<{ route: string; request: (team: TeamIds) => TeamRequest }> = [
  { route: "GET /v1/organizations", request: () => get("/v1/organizations") },
  { route: "GET /v1/organization-members", request: () => get("/v1/organization-members") },
  { route: "GET /v1/organization-invitations", request: () => get("/v1/organization-invitations") },
  { route: "GET /v1/projects", request: () => get("/v1/projects") },
  { route: "GET /v1/deployments?projectId", request: team => get(`/v1/deployments?projectId=${team.grantedProjectId}`) },
  { route: "GET /v1/project-budgets?projectId", request: team => get(`/v1/project-budgets?projectId=${team.grantedProjectId}`) },
  { route: "GET /v1/organization-activities?projectId", request: team => get(`/v1/organization-activities?projectId=${team.grantedProjectId}`) },
  { route: "GET /v1/project-spend", request: () => get("/v1/project-spend") },
  { route: "GET /v1/api-keys", request: () => get("/v1/api-keys") },
  { route: "GET /v1/wallets?userId", request: team => get(`/v1/wallets?userId=${team.ownerUserId}`) },
  { route: "GET /v1/stripe/transactions", request: () => get("/v1/stripe/transactions") }
];

const MIN_IDENTIFIER_LENGTH = 12;

const STRIPE_API = "https://api.stripe.com";

const TEAM_TABLES = [
  "organization_members",
  "organization_invitations",
  "projects",
  "project_members",
  "project_budgets",
  "api_keys",
  "deployment_settings",
  "user_wallets",
  "wallet_settings",
  "stripe_transactions",
  "organization_activities",
  "payment_methods",
  "template"
];

describe("Cross-team access", () => {
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

  describe.each(["session", "apiKey"] as const)("a route naming an id of another team, called with the %s of that team's owner", credential => {
    it.each(ROUTES_NAMING_ANOTHER_TEAM)("answers $status to $route, changing and revealing nothing", async ({ request, status, echoes = [] }) => {
      const { team, otherTeam, otherOwner, send, rowsOf } = await setup();
      const before = await rowsOf(team.organizationId);

      const response = await send(request(team, otherTeam), otherOwner[credential]);

      expect(response.status).toBe(status);
      expect(await rowsOf(team.organizationId)).toEqual(before);
      expect(await response.text()).not.toMatch(identifiersPattern(team, echoes));
    });
  });

  describe("a route naming an id of another team", () => {
    it.each(ROUTES_NAMING_ANOTHER_TEAM)("refuses $route to a session of another team naming the team in its header", async ({ request }) => {
      const { team, otherTeam, otherOwner, send, rowsOf } = await setup();
      const before = await rowsOf(team.organizationId);

      const response = await send(request(team, otherTeam), { ...otherOwner.session, "x-organization-id": team.organizationId });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "organization_forbidden" });
      expect(await rowsOf(team.organizationId)).toEqual(before);
    });

    it.each(ROUTES_NAMING_ANOTHER_TEAM)("answers $ownerStatus to $route from the team's own owner", async ({ request, ownerStatus }) => {
      const { team, owner, send } = await setup();

      const response = await send(request(team, team), owner.session);

      expect(response.status).toBe(ownerStatus);
    });
  });

  describe("a read of the caller's own team", () => {
    it.each(READS_OF_THE_OWN_TEAM)("leaves everything of another team out of $route", async ({ request }) => {
      const { team, otherOwner, send } = await setup();

      const response = await send(request(team), otherOwner.session);

      expect(response.status).toBe(200);
      expect(await response.text()).not.toMatch(identifiersPattern(team));
    });

    it("names no deployment of another team in GET /v1/deployment-names", async () => {
      const { team, otherOwner, send } = await setup();

      const response = await send(get(`/v1/deployment-names?dseq=${team.grantedDseq}`), otherOwner.session);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { [team.grantedDseq]: null } });
    });
  });

  describe("the organization and project a request names", () => {
    it.each([
      { naming: "the team's slug", header: (team: TeamIds) => ({ "x-organization-id": team.slug }), code: "organization_forbidden", status: 403 },
      { naming: "a project of the team", header: (team: TeamIds) => ({ "x-project-id": team.grantedProjectId }), code: "project_forbidden", status: 403 }
    ])("refuses a session of another team naming $naming", async ({ header, code, status }) => {
      const { team, otherOwner, send } = await setup();

      const response = await send(get("/v1/projects"), { authorization: otherOwner.session.authorization, ...header(team) });

      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ code });
    });

    it.each([
      { naming: "the team", header: (team: TeamIds) => ({ "x-organization-id": team.organizationId }), code: "organization_mismatch", status: 400 },
      { naming: "a project of the team", header: (team: TeamIds) => ({ "x-project-id": team.grantedProjectId }), code: "project_forbidden", status: 403 }
    ])("refuses an API key of another team naming $naming", async ({ header, code, status }) => {
      const { team, otherOwner, send } = await setup();

      const response = await send(get("/v1/projects"), { ...otherOwner.apiKey, ...header(team) });

      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ code });
    });

    it("runs a request in the caller's own organization when the team they last used is not theirs", async () => {
      const { team, otherTeam, otherOwner, send } = await setup();
      const users = resolveTable("Users");
      await db.update(users).set({ lastUsedOrganizationId: team.organizationId }).where(eq(users.id, otherTeam.ownerUserId));

      const response = await send(get("/v1/projects"), { authorization: otherOwner.session.authorization });

      expect(response.status).toBe(200);
      expect(await response.text()).not.toMatch(identifiersPattern(team));
    });
  });

  describe("a member who left the team", () => {
    it("is refused the team through their session and through the API key they held in it", async () => {
      const { team, send, departedMember } = await setup();

      const sessionResponse = await send(get("/v1/projects"), departedMember.session);
      const keyResponse = await send(get("/v1/projects"), departedMember.apiKey);

      expect([sessionResponse.status, keyResponse.status]).toEqual([403, 403]);
      expect(await sessionResponse.text()).not.toMatch(identifiersPattern(team));
    });
  });

  describe("the notifications proxy", () => {
    it.each([
      { route: "GET /v1/deployment-alerts/{dseq}", request: (team: TeamIds) => get(`/v1/deployment-alerts/${team.grantedDseq}`) },
      {
        route: "POST /v1/deployment-alerts/{dseq}",
        request: (team: TeamIds) =>
          post(`/v1/deployment-alerts/${team.grantedDseq}`, { alerts: { deploymentClosed: { notificationChannelId: faker.string.uuid(), enabled: true } } })
      },
      { route: "GET /v1/alerts?dseq", request: (team: TeamIds) => get(`/v1/alerts?dseq=${team.grantedDseq}`) },
      {
        route: "POST /v1/alerts",
        request: (team: TeamIds) =>
          post("/v1/alerts", { notificationChannelId: faker.string.uuid(), enabled: true, type: "DEPLOYMENT_BALANCE", params: { dseq: team.grantedDseq } })
      },
      { route: "PATCH /v1/alerts/{id}", request: () => patch(`/v1/alerts/${faker.string.uuid()}`, { enabled: false }) },
      { route: "DELETE /v1/notification-channels/{id}", request: () => remove(`/v1/notification-channels/${faker.string.uuid()}`) }
    ])("forwards $route with the identity of the caller's own team and wallet only", async ({ request }) => {
      const { team, otherTeam, otherOwner, send } = await setup();
      const forwardedRequest = request(team);
      const forwarded = interceptNotifications(forwardedRequest.method, forwardedRequest.path);

      const response = await send(forwardedRequest, otherOwner.session);

      expect(response.status).toBe(200);
      expect(forwarded.headers()).toMatchObject({ "x-organization-id": otherTeam.organizationId, "x-owner-address": otherTeam.walletAddress });
      expect(JSON.stringify(forwarded.headers())).not.toMatch(identifiersPattern(team));
    });
  });

  function identifiersPattern(team: TeamIds, echoes: Array<keyof TeamIds> = []) {
    const identifiers = Object.entries(team)
      .filter(([kind, value]) => value.length >= MIN_IDENTIFIER_LENGTH && !echoes.includes(kind as keyof TeamIds))
      .map(([, value]) => value);

    return new RegExp(identifiers.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));
  }

  function interceptNotifications(method: string, path: string) {
    let forwarded: Record<string, string | string[] | undefined> | undefined;

    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
      .intercept(path, method)
      .reply(function reply(this: nock.ReplyFnContext) {
        forwarded = this.req.headers;

        return [200, { data: {} }];
      });

    return { headers: () => forwarded ?? {} };
  }

  async function seedTeam(sessions: Map<string, string>) {
    const stripeCustomerId = `cus_${faker.string.alphanumeric(14)}`;
    const { user: owner, organization } = await seedOrganizationWithOwner({ stripeCustomerId, user: { userId: faker.string.uuid() } });
    const [grantedProject, otherProject] = await Promise.all([
      seedProject({ organizationId: organization.id, name: "Granted", createdByUserId: owner.id }),
      seedProject({ organizationId: organization.id, name: "Other", createdByUserId: owner.id })
    ]);
    const [admin, member, viewer] = await Promise.all([seedUser(), seedUser(), seedUser()]);
    const [adminMembership, memberMembership] = await Promise.all([
      seedOrganizationMember({ organizationId: organization.id, userId: admin.id, role: "admin" }),
      seedOrganizationMember({ organizationId: organization.id, userId: member.id, role: "member" }),
      seedOrganizationMember({ organizationId: organization.id, userId: viewer.id, role: "viewer" })
    ]);
    const projectGrant = await seedProjectMember({ organizationId: organization.id, projectId: grantedProject.id, userId: member.id, role: "member" });
    const invitation = await seedOrganizationInvitation({ organizationId: organization.id, invitedByUserId: owner.id });
    const [budget] = await db
      .insert(resolveTable("ProjectBudgets"))
      .values({ organizationId: organization.id, projectId: grantedProject.id, monthlyAmountCents: 5000 })
      .returning();
    const [wallet] = await db
      .insert(resolveTable("UserWallets"))
      .values({ userId: null, organizationId: organization.id, address: createAkashAddress(), isTrialing: false, activatedAt: new Date() })
      .returning();
    await seedWalletSetting({ userId: owner.id, walletId: wallet.id, organizationId: organization.id });
    const grantedDseq = faker.string.numeric({ length: 14, allowLeadingZeros: false });
    await seedDeploymentSetting({
      userId: owner.id,
      dseq: grantedDseq,
      organizationId: organization.id,
      projectId: grantedProject.id,
      name: faker.word.words(3)
    });
    await seedOrganizationActivity({ organizationId: organization.id, projectId: grantedProject.id, actorUserId: owner.id });
    const [transaction] = await db
      .insert(resolveTable("StripeTransactions"))
      .values({
        userId: owner.id,
        organizationId: organization.id,
        type: "payment_intent",
        status: "succeeded",
        amount: 2500,
        currency: "usd",
        stripePaymentIntentId: `pi_${faker.string.alphanumeric(14)}`,
        stripeInvoiceId: `in_${faker.string.alphanumeric(14)}`
      })
      .returning();
    nock(STRIPE_API)
      .persist()
      .get(`/v1/invoices/${transaction.stripeInvoiceId}`)
      .reply(200, { id: transaction.stripeInvoiceId, object: "invoice", status: "paid", invoice_pdf: "https://pay.stripe.com/invoice" });
    const ownerKey = await seedApiKey({ userId: owner.id, organizationId: organization.id });
    const paymentMethodId = await seedCard({ stripeCustomerId, userId: owner.id, organizationId: organization.id });
    answerPaymentIntent({ id: transaction.stripePaymentIntentId as string, customer: stripeCustomerId, payment_method: paymentMethodId });
    const [template] = await db
      .insert(resolveTable("Templates"))
      .values({
        userId: owner.userId!,
        organizationId: organization.id,
        projectId: grantedProject.id,
        title: faker.word.words(2),
        sdl: SDL,
        cpu: 100,
        ram: 100,
        storage: 100
      })
      .returning();

    const ids: TeamIds = {
      organizationId: organization.id,
      slug: organization.slug,
      ownerUserId: owner.id,
      adminMembershipId: adminMembership.id,
      memberMembershipId: memberMembership.id,
      viewerUserId: viewer.id,
      invitationId: invitation.id,
      grantedProjectId: grantedProject.id,
      otherProjectId: otherProject.id,
      projectGrantId: projectGrant.id,
      budgetId: budget.id,
      ownerKeyId: ownerKey.id,
      grantedDseq,
      walletAddress: wallet.address as string,
      transactionId: transaction.id,
      paymentIntentId: transaction.stripePaymentIntentId as string,
      paymentMethodId,
      templateId: template.id
    };
    const ownerCredentials = {
      session: { ...signIn(owner.userId!, sessions), "x-organization-id": organization.id },
      apiKey: { "x-api-key": ownerKey.secret }
    };

    return { ids, ownerCredentials };
  }

  async function seedCard(input: { stripeCustomerId: string; userId: string; organizationId: string }) {
    const card = {
      id: `pm_${faker.string.alphanumeric(24)}`,
      object: "payment_method",
      type: "card",
      created: 1_700_000_000,
      customer: input.stripeCustomerId,
      card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030, fingerprint: faker.string.alphanumeric(16) }
    };
    await db.insert(resolveTable("PaymentMethods")).values({
      userId: input.userId,
      organizationId: input.organizationId,
      fingerprint: card.card.fingerprint,
      paymentMethodId: card.id
    });
    nock(STRIPE_API)
      .persist()
      .get(`/v1/payment_methods/${card.id}`)
      .reply(200, card)
      .post(`/v1/payment_methods/${card.id}/detach`)
      .reply(200, { ...card, customer: null });

    return card.id;
  }

  function answerPaymentIntent(paymentIntent: { id: string; customer: string; payment_method: string }) {
    nock(STRIPE_API)
      .persist()
      .get(`/v1/payment_intents/${paymentIntent.id}`)
      .reply(200, { ...paymentIntent, object: "payment_intent", status: "requires_payment_method" });
  }

  function answerNewPaymentIntents() {
    nock(STRIPE_API)
      .persist()
      .post("/v1/payment_intents")
      .reply(200, () => ({ id: `pi_${faker.string.alphanumeric(14)}`, object: "payment_intent", status: "requires_action", client_secret: "secret" }));
  }

  function answerSigning() {
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(/\/cosmos\/feegrant\/v1beta1\/allowances?\/.*/)
      .reply(200, uri => (uri.includes("/allowances/") ? { allowances: [createFeeAllowanceResponse()] } : createFeeAllowanceResponse({ amount: "5000000" })))
      .get(/\/cosmos\/authz\/v1beta1\/grants\?.*/)
      .reply(200, createDeploymentGrantResponseSeed({ amount: "5000000", grantType: "/akash.escrow.v1.DepositAuthorization" }));
    nock(container.resolve(BILLING_CONFIG).TX_SIGNER_BASE_URL)
      .persist()
      .post(/\/v1\/tx\/.*/)
      .reply(200, { data: { code: 0, hash: "SOME_HASH", rawLog: "[]" } });
  }

  async function seedDepartedMember(organizationId: string, sessions: Map<string, string>) {
    const user = await seedUser({ userId: faker.string.uuid() });
    const key = await seedApiKey({ userId: user.id, organizationId });

    return { session: { ...signIn(user.userId!, sessions), "x-organization-id": organizationId }, apiKey: { "x-api-key": key.secret } };
  }

  async function seedApiKey(input: { userId: string; organizationId: string }) {
    const generator = container.resolve(ApiKeyGeneratorService);
    const secret = generator.generateApiKey();
    const key = await container.resolve(ApiKeyRepository).create({
      ...input,
      name: faker.word.noun(),
      hashedKey: generator.hashApiKeySha256(secret),
      keyFormat: generator.obfuscateApiKey(secret)
    });

    return { id: key.id, secret };
  }

  function signIn(externalUserId: string, sessions: Map<string, string>) {
    const token = faker.string.alphanumeric(40);
    sessions.set(token, externalUserId);

    return { authorization: `Bearer ${token}` };
  }

  function answerDeploymentsOnChain(teams: TeamIds[]) {
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(uri => uri.includes("/deployments/info"))
      .reply(uri => {
        const query = new URL(uri, "http://chain").searchParams;
        const deployed = teams.find(team => team.walletAddress === query.get("id.owner") && team.grantedDseq === query.get("id.dseq"));

        return deployed
          ? [200, createDeploymentInfoSeed({ owner: deployed.walletAddress, dseq: deployed.grantedDseq })]
          : [404, createDeploymentInfoErrorSeed()];
      })
      .get(uri => uri.includes("/leases/list"))
      .reply(200, { leases: [], pagination: { next_key: null, total: "0" } });
  }

  async function setup() {
    const sessions = new Map<string, string>();
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => sessions.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => flag !== FeatureFlags.ORGANIZATIONS_ENFORCE);

    const { ids: team, ownerCredentials: owner } = await seedTeam(sessions);
    const { ids: otherTeam, ownerCredentials: otherOwner } = await seedTeam(sessions);
    const departedMember = await seedDepartedMember(team.organizationId, sessions);
    answerDeploymentsOnChain([team, otherTeam]);
    answerNewPaymentIntents();
    answerSigning();
    vi.spyOn(container.resolve(DenomExchangeService), "getExchangeRateToUSD").mockResolvedValue(
      mock<Awaited<ReturnType<DenomExchangeService["getExchangeRateToUSD"]>>>({ price: 2 })
    );

    const send = async ({ method, path, body }: TeamRequest, headers: Record<string, string>) =>
      await app.request(path, {
        method,
        headers: body === undefined ? headers : { ...headers, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });

    const rowsOf = async (organizationId: string) => {
      const [organization] = await db.execute(sql`select * from organizations where id = ${organizationId}`);
      const tables = await Promise.all(
        TEAM_TABLES.map(async table => await db.execute(sql`select * from ${sql.identifier(table)} where organization_id = ${organizationId} order by id`))
      );

      return { organization, tables };
    };

    return { team, owner, otherTeam, otherOwner, departedMember, send, rowsOf };
  }
});
