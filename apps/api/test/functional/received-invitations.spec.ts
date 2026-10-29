import { faker } from "@faker-js/faker";
import type { GetUsers200ResponseOneOfInner } from "auth0";
import { addDays } from "date-fns";
import { and, eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationInvitationInput } from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";

import {
  seedOrganization,
  seedOrganizationInvitation,
  seedOrganizationMember,
  seedOrganizationWithOwner,
  seedProject
} from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe("Received invitations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/received-invitations", () => {
    it("lists the open invitations sent to the caller's verified email, newest first", async () => {
      const { organization, owner, invite, seedInvitee, request } = await setup({});
      const invitee = await seedInvitee();
      const { organization: otherTeam } = await seedOrganizationWithOwner();
      const older = await invite({ email: invitee.email!, role: "admin", createdAt: addDays(new Date(), -2) });
      const newer = await invite({ email: invitee.email!, organizationId: otherTeam.id, invitedByUserId: null, createdAt: addDays(new Date(), -1) });
      await invite({ email: `someone-else-${invitee.email!}` });

      const response = await request("/v1/received-invitations", { method: "GET", asUser: invitee });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: [
          {
            id: newer.id,
            organizationId: otherTeam.id,
            organizationName: otherTeam.name,
            inviterName: null,
            role: "member",
            createdAt: newer.createdAt.toISOString(),
            expiresAt: newer.expiresAt.toISOString()
          },
          {
            id: older.id,
            organizationId: organization.id,
            organizationName: organization.name,
            inviterName: owner.username,
            role: "admin",
            createdAt: older.createdAt.toISOString(),
            expiresAt: older.expiresAt.toISOString()
          }
        ]
      });
    });

    it("lists nothing for a caller whose email Auth0 has not verified", async () => {
      const { invite, seedInvitee, request } = await setup({});
      const invitee = await seedInvitee({ auth0: { emailVerified: false } });
      await invite({ email: invitee.email! });

      const response = await request("/v1/received-invitations", { method: "GET", asUser: invitee });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: [] });
    });

    it("refuses an API key", async () => {
      const { invite, seedInvitee, seedApiKey, request } = await setup({});
      const invitee = await seedInvitee();
      await invite({ email: invitee.email! });

      const response = await request("/v1/received-invitations", { method: "GET", apiKey: await seedApiKey(invitee) });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "session_required" });
    });

    it("refuses a signed-out caller", async () => {
      const { request } = await setup({});

      const response = await request("/v1/received-invitations", { method: "GET" });

      expect(response.status).toBe(401);
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { seedInvitee, request } = await setup({ organizationsOn: false });
      const invitee = await seedInvitee();

      const response = await request("/v1/received-invitations", { method: "GET", asUser: invitee });

      expect(response.status).toBe(404);
    });
  });

  describe("POST /v1/received-invitations/{id}/accept", () => {
    it("joins the invitee with the invited role and project access and makes the organization their last used one", async () => {
      const { organization, project, invite, seedInvitee, request, membershipsOf, grantsOf, userOf, invitationOf } = await setup({});
      const invitee = await seedInvitee();
      const invitation = await invite({ email: invitee.email!, role: "member", projectGrants: [{ projectId: project.id, role: "viewer" }] });

      const response = await request(`/v1/received-invitations/${invitation.id}/accept`, { asUser: invitee });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { id: organization.id, name: organization.name, type: "team", role: "member", isActive: false } });
      expect(await membershipsOf(invitee)).toEqual([expect.objectContaining({ role: "member" })]);
      expect(await grantsOf(invitee)).toEqual([expect.objectContaining({ projectId: project.id, role: "viewer" })]);
      expect(await userOf(invitee)).toMatchObject({ lastUsedOrganizationId: organization.id });
      expect(await invitationOf(invitation.id)).toMatchObject({ status: "accepted", acceptedByUserId: invitee.id });
    });

    it("joins through the address Auth0 verified for the caller", async () => {
      const { organization, invite, seedInvitee, request, membershipsOf } = await setup({});
      const invitee = await seedInvitee({ emailVerified: false, auth0: { email: "Jane.Doe@Example.com" } });
      const invitation = await invite({ email: "jane.doe@example.com" });

      const response = await request(`/v1/received-invitations/${invitation.id}/accept`, { asUser: invitee });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { id: organization.id } });
      expect(await membershipsOf(invitee)).toEqual([expect.objectContaining({ role: "member" })]);
    });

    it.each([
      { case: "sent to another address", invitee: {}, invitation: { email: "jane@example.com" } },
      {
        case: "sent to an address Auth0 has not verified for the caller",
        invitee: { auth0: { emailVerified: false } },
        invitation: {}
      },
      {
        case: "sent to an address Auth0 no longer has for the caller",
        invitee: { auth0: { email: "joe@example.com" } },
        invitation: {}
      }
    ])("answers not found for an invitation $case and leaves it pending", async ({ invitee: inviteeOverrides, invitation: overrides }) => {
      const { invite, seedInvitee, request, membershipsOf, invitationOf } = await setup({});
      const invitee = await seedInvitee(inviteeOverrides);
      const invitation = await invite({ email: invitee.email!, ...overrides });

      const response = await request(`/v1/received-invitations/${invitation.id}/accept`, { asUser: invitee });

      expect(response.status).toBe(404);
      expect(await membershipsOf(invitee)).toEqual([]);
      expect(await invitationOf(invitation.id)).toMatchObject({ status: "pending", acceptedByUserId: null });
    });

    it.each([
      { case: "expired", invitation: { expiresAt: addDays(new Date(), -1) }, code: "invitation_expired" },
      { case: "revoked", invitation: { status: "revoked" as const, revokedAt: new Date() }, code: "invitation_revoked" },
      { case: "declined", invitation: { status: "declined" as const, declinedAt: new Date() }, code: "invitation_declined" }
    ])("explains that the invitation is $case", async ({ invitation: overrides, code }) => {
      const { invite, seedInvitee, request, membershipsOf } = await setup({});
      const invitee = await seedInvitee();
      const invitation = await invite({ email: invitee.email!, ...overrides });

      const response = await request(`/v1/received-invitations/${invitation.id}/accept`, { asUser: invitee });

      expect(response.status).toBe(410);
      expect(await response.json()).toMatchObject({ code });
      expect(await membershipsOf(invitee)).toEqual([]);
    });

    it("refuses an API key and writes nothing", async () => {
      const { invite, seedInvitee, seedApiKey, request, membershipsOf, invitationOf } = await setup({});
      const invitee = await seedInvitee();
      const invitation = await invite({ email: invitee.email! });

      const response = await request(`/v1/received-invitations/${invitation.id}/accept`, { apiKey: await seedApiKey(invitee) });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "session_required" });
      expect(await membershipsOf(invitee)).toEqual([]);
      expect(await invitationOf(invitation.id)).toMatchObject({ status: "pending" });
    });

    it("rejects an id that is not a uuid", async () => {
      const { seedInvitee, request } = await setup({});
      const invitee = await seedInvitee();

      const response = await request("/v1/received-invitations/not-a-uuid/accept", { asUser: invitee });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /v1/received-invitations/{id}/decline", () => {
    it("declines the invitation and tells the team which address declined, without naming the account", async () => {
      const { organization, invite, seedInvitee, request, membershipsOf, invitationOf, teamActivities } = await setup({});
      const invitee = await seedInvitee();
      const invitation = await invite({ email: invitee.email!, role: "admin" });

      const response = await request(`/v1/received-invitations/${invitation.id}/decline`, { asUser: invitee });

      expect(response.status).toBe(204);
      expect(await invitationOf(invitation.id)).toMatchObject({ status: "declined", declinedAt: expect.any(Date), acceptedByUserId: null });
      expect(await membershipsOf(invitee)).toEqual([]);
      expect(await teamActivities(organization.id, "invitation_declined")).toEqual([
        expect.objectContaining({ actorUserId: null, payload: { email: invitee.email } })
      ]);
    });

    it("records one decline when the invitee declines twice", async () => {
      const { organization, invite, seedInvitee, request, teamActivities } = await setup({});
      const invitee = await seedInvitee();
      const invitation = await invite({ email: invitee.email! });

      const first = await request(`/v1/received-invitations/${invitation.id}/decline`, { asUser: invitee });
      const second = await request(`/v1/received-invitations/${invitation.id}/decline`, { asUser: invitee });

      expect([first.status, second.status]).toEqual([204, 204]);
      expect(await teamActivities(organization.id, "invitation_declined")).toHaveLength(1);
    });

    it("refuses an invitation the invitee already accepted", async () => {
      const { invite, seedInvitee, request, invitationOf } = await setup({});
      const invitee = await seedInvitee();
      const invitation = await invite({ email: invitee.email!, status: "accepted", acceptedByUserId: invitee.id, acceptedAt: new Date() });

      const response = await request(`/v1/received-invitations/${invitation.id}/decline`, { asUser: invitee });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "invitation_already_accepted" });
      expect(await invitationOf(invitation.id)).toMatchObject({ status: "accepted" });
    });

    it("answers not found for an invitation sent to an address Auth0 has not verified for the caller and leaves it pending", async () => {
      const { organization, invite, seedInvitee, request, invitationOf, teamActivities } = await setup({});
      const invitee = await seedInvitee({ auth0: { emailVerified: false } });
      const invitation = await invite({ email: invitee.email! });

      const response = await request(`/v1/received-invitations/${invitation.id}/decline`, { asUser: invitee });

      expect(response.status).toBe(404);
      expect(await invitationOf(invitation.id)).toMatchObject({ status: "pending", declinedAt: null });
      expect(await teamActivities(organization.id, "invitation_declined")).toEqual([]);
    });

    it("refuses an API key and writes nothing", async () => {
      const { invite, seedInvitee, seedApiKey, request, invitationOf } = await setup({});
      const invitee = await seedInvitee();
      const invitation = await invite({ email: invitee.email! });

      const response = await request(`/v1/received-invitations/${invitation.id}/decline`, { apiKey: await seedApiKey(invitee) });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "session_required" });
      expect(await invitationOf(invitation.id)).toMatchObject({ status: "pending" });
    });
  });

  async function setup(input: { organizationsOn?: boolean }) {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const OrganizationMembers = resolveTable("OrganizationMembers");
    const OrganizationInvitations = resolveTable("OrganizationInvitations");
    const OrganizationActivities = resolveTable("OrganizationActivities");
    const ProjectMembers = resolveTable("ProjectMembers");
    const Users = resolveTable("Users");
    const externalUserIdByToken = new Map<string, string>();
    const bearerByUserId = new Map<string, string>();
    const personalOrganizationIdByUserId = new Map<string, string>();
    const auth0UserByUserId = new Map<string, { email: string; email_verified: boolean }>();
    const { organization, user: owner } = await seedOrganizationWithOwner({
      user: { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `owner-${faker.string.alphanumeric(12)}` }
    });
    const project = await seedProject({ organizationId: organization.id });

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => externalUserIdByToken.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(Auth0Service), "getUser").mockImplementation(async userId => {
      const auth0User = auth0UserByUserId.get(userId);

      return auth0User ? mock<GetUsers200ResponseOneOfInner>({ user_id: userId, ...auth0User }) : null;
    });
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return input.organizationsOn !== false;
    });

    async function seedInvitee(overrides: { emailVerified?: boolean; auth0?: { email?: string; emailVerified?: boolean } } = {}) {
      const user = await seedUser({
        userId: `auth0|${faker.string.alphanumeric(24)}`,
        username: `user-${faker.string.alphanumeric(12)}`,
        email: `invitee-${faker.string.alphanumeric(12).toLowerCase()}@example.com`,
        emailVerified: overrides.emailVerified ?? true
      });
      auth0UserByUserId.set(user.userId!, { email: overrides.auth0?.email ?? user.email!, email_verified: overrides.auth0?.emailVerified ?? true });
      const personal = await seedOrganization({ type: "personal", createdByUserId: user.id });
      await seedOrganizationMember({ organizationId: personal.id, userId: user.id, role: "owner" });
      const bearer = faker.string.alphanumeric(40);
      externalUserIdByToken.set(bearer, user.userId!);
      bearerByUserId.set(user.id, bearer);
      personalOrganizationIdByUserId.set(user.id, personal.id);

      return user;
    }

    async function invite(overrides: Partial<OrganizationInvitationInput>) {
      return await seedOrganizationInvitation({ organizationId: organization.id, invitedByUserId: owner.id, ...overrides });
    }

    async function request(path: string, options: { method?: "GET" | "POST"; asUser?: UserOutput; apiKey?: string }) {
      const headers: Record<string, string> = {};

      if (options.asUser) {
        headers.authorization = `Bearer ${bearerByUserId.get(options.asUser.id)}`;
      }

      if (options.apiKey) {
        headers["x-api-key"] = options.apiKey;
      }

      return await app.request(path, { method: options.method ?? "POST", headers });
    }

    async function seedApiKey(user: UserOutput) {
      const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
      const apiKey = apiKeyGenerator.generateApiKey();
      await container.resolve(ApiKeyRepository).create({
        userId: user.id,
        organizationId: personalOrganizationIdByUserId.get(user.id),
        hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
        keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey),
        name: "ci"
      });

      return apiKey;
    }

    async function membershipsOf(user: UserOutput) {
      return await db
        .select()
        .from(OrganizationMembers)
        .where(and(eq(OrganizationMembers.organizationId, organization.id), eq(OrganizationMembers.userId, user.id)));
    }

    async function grantsOf(user: UserOutput) {
      return await db.select().from(ProjectMembers).where(eq(ProjectMembers.userId, user.id));
    }

    async function userOf(user: UserOutput) {
      const [row] = await db.select().from(Users).where(eq(Users.id, user.id));

      return row;
    }

    async function invitationOf(id: string) {
      const [invitation] = await db.select().from(OrganizationInvitations).where(eq(OrganizationInvitations.id, id));

      return invitation;
    }

    async function teamActivities(organizationId: string, type: "invitation_declined") {
      return await db
        .select()
        .from(OrganizationActivities)
        .where(and(eq(OrganizationActivities.organizationId, organizationId), eq(OrganizationActivities.type, type)));
    }

    return { organization, project, owner, invite, seedInvitee, seedApiKey, request, membershipsOf, grantsOf, userOf, invitationOf, teamActivities };
  }
});
