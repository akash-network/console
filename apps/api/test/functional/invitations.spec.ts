import { faker } from "@faker-js/faker";
import { addDays } from "date-fns";
import { and, eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { createInvitationToken, hashInvitationToken } from "@src/organization/lib/invitation-token/invitation-token";
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

describe("Invitations", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("POST /v1/invitations/preview", () => {
    it("shows a signed-out visitor who invited them, to which organization and as what", async () => {
      const { organization, owner, invite, request } = await setup({ organizationsOn: false });
      const { token, invitation } = await invite({ email: "jane@example.com", role: "admin" });

      const response = await request("/v1/invitations/preview", { body: { data: { token } } });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          organizationName: organization.name,
          inviterName: owner.username,
          role: "admin",
          email: "jane@example.com",
          status: "pending",
          expiresAt: invitation.expiresAt.toISOString()
        }
      });
    });

    it.each([
      { status: "expired", invitation: { expiresAt: addDays(new Date(), -1) } },
      { status: "revoked", invitation: { status: "revoked" as const, revokedAt: new Date() } },
      { status: "accepted", invitation: { status: "accepted" as const, acceptedAt: new Date() } }
    ])("tells the visitor the invitation is $status", async ({ status, invitation }) => {
      const { invite, request } = await setup({});
      const { token } = await invite(invitation);

      const response = await request("/v1/invitations/preview", { body: { data: { token } } });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { status } });
    });

    it("answers not found for a token no invitation carries", async () => {
      const { request } = await setup({});

      const response = await request("/v1/invitations/preview", { body: { data: { token: createInvitationToken() } } });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: "not_found", message: "Invitation not found" });
    });

    it("answers not found for an invitation of a deleted organization", async () => {
      const { invite, organization, request } = await setup({});
      const { token } = await invite({});
      const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
      const Organizations = resolveTable("Organizations");
      await db.update(Organizations).set({ deletedAt: new Date() }).where(eq(Organizations.id, organization.id));

      const response = await request("/v1/invitations/preview", { body: { data: { token } } });

      expect(response.status).toBe(404);
    });

    it("rejects a token that is not an invitation token", async () => {
      const { request } = await setup({});

      const response = await request("/v1/invitations/preview", { body: { data: { token: "not-a-token" } } });

      expect(response.status).toBe(400);
      expect(JSON.stringify(await response.json())).not.toContain("not-a-token");
    });
  });

  describe("POST /v1/invitations/accept", () => {
    it("joins the invitee with the invited role and project access and makes the organization their last used one", async () => {
      const { organization, project, invite, seedInvitee, request, membershipsOf, grantsOf, userOf } = await setup({});
      const invitee = await seedInvitee({ email: `Jane.${faker.string.alphanumeric(8)}@Example.com` });
      const { token, invitation } = await invite({
        email: invitee.email!.toLowerCase(),
        role: "member",
        projectGrants: [{ projectId: project.id, role: "viewer" }]
      });

      const response = await request("/v1/invitations/accept", { asUser: invitee, body: { data: { token } } });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          type: "team",
          role: "member",
          isActive: false,
          createdAt: organization.createdAt.toISOString()
        }
      });
      expect(await membershipsOf(invitee)).toEqual([expect.objectContaining({ role: "member" })]);
      expect(await grantsOf(invitee)).toEqual([expect.objectContaining({ projectId: project.id, role: "viewer" })]);
      expect(await userOf(invitee)).toMatchObject({ lastUsedOrganizationId: organization.id });
      expect(await invitationOf(invitation.id)).toMatchObject({ status: "accepted", acceptedByUserId: invitee.id });
    });

    it("asks an invitee signed in with another email to confirm, then lets them join", async () => {
      const { invite, seedInvitee, request, membershipsOf } = await setup({});
      const invitee = await seedInvitee();
      const { token } = await invite({ email: "jane@example.com", role: "member" });

      const refused = await request("/v1/invitations/accept", { asUser: invitee, body: { data: { token } } });
      const membershipsAfterRefusal = await membershipsOf(invitee);
      const confirmed = await request("/v1/invitations/accept", { asUser: invitee, body: { data: { token, confirmEmailMismatch: true } } });

      expect(refused.status).toBe(409);
      expect(await refused.json()).toMatchObject({ code: "invitation_email_mismatch" });
      expect(membershipsAfterRefusal).toEqual([]);
      expect(confirmed.status).toBe(200);
      expect(await membershipsOf(invitee)).toEqual([expect.objectContaining({ role: "member" })]);
    });

    it.each([
      { case: "expired", invitation: { expiresAt: addDays(new Date(), -1) }, status: 410, code: "invitation_expired" },
      { case: "revoked", invitation: { status: "revoked" as const, revokedAt: new Date() }, status: 410, code: "invitation_revoked" }
    ])("explains that the invitation is $case", async ({ invitation, status, code }) => {
      const { invite, seedInvitee, request, membershipsOf } = await setup({});
      const invitee = await seedInvitee();
      const { token } = await invite({ email: invitee.email!, ...invitation });

      const response = await request("/v1/invitations/accept", { asUser: invitee, body: { data: { token } } });

      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ code });
      expect(await membershipsOf(invitee)).toEqual([]);
    });

    it("refuses an invitation someone else already accepted", async () => {
      const { invite, seedInvitee, request, membershipsOf } = await setup({});
      const [winner, invitee] = await Promise.all([seedInvitee(), seedInvitee()]);
      const { token } = await invite({ email: invitee.email!, status: "accepted", acceptedByUserId: winner.id, acceptedAt: new Date() });

      const response = await request("/v1/invitations/accept", { asUser: invitee, body: { data: { token } } });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "invitation_already_accepted" });
      expect(await membershipsOf(invitee)).toEqual([]);
    });

    it("answers the organization again when the invitee accepts twice", async () => {
      const { organization, invite, seedInvitee, request, membershipsOf } = await setup({});
      const invitee = await seedInvitee();
      const { token } = await invite({ email: invitee.email!, role: "admin" });

      const first = await request("/v1/invitations/accept", { asUser: invitee, body: { data: { token } } });
      const second = await request("/v1/invitations/accept", { asUser: invitee, body: { data: { token } } });

      expect([first.status, second.status]).toEqual([200, 200]);
      expect(await second.json()).toMatchObject({ data: { id: organization.id, role: "admin" } });
      expect(await membershipsOf(invitee)).toEqual([expect.objectContaining({ role: "admin" })]);
    });

    it("lets exactly one of two users racing the same link join", async () => {
      const { organization, invite, seedInvitee, request } = await setup({});
      const invitees = await Promise.all([seedInvitee(), seedInvitee()]);
      const { token } = await invite({ email: "jane@example.com", role: "member" });

      const responses = await Promise.all(
        invitees.map(invitee => request("/v1/invitations/accept", { asUser: invitee, body: { data: { token, confirmEmailMismatch: true } } }))
      );

      expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
      expect(await countMembers(organization.id, "member")).toBe(1);
    });

    it("keeps one membership when the invitee submits the acceptance twice at once", async () => {
      const { invite, seedInvitee, request, membershipsOf } = await setup({});
      const invitee = await seedInvitee();
      const { token } = await invite({ email: invitee.email!, role: "member" });

      const responses = await Promise.all([1, 2].map(() => request("/v1/invitations/accept", { asUser: invitee, body: { data: { token } } })));

      expect(responses.map(response => response.status)).toEqual([200, 200]);
      expect(await membershipsOf(invitee)).toHaveLength(1);
    });

    it("lets a member of another team organization join while working in it", async () => {
      const { organization, invite, seedInvitee, request, membershipsOf } = await setup({});
      const invitee = await seedInvitee();
      const { organization: otherTeam } = await seedOrganizationWithOwner();
      await seedOrganizationMember({ organizationId: otherTeam.id, userId: invitee.id, role: "member" });
      const { token } = await invite({ email: invitee.email!, role: "viewer" });

      const response = await request("/v1/invitations/accept", { asUser: invitee, organizationId: otherTeam.id, body: { data: { token } } });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { id: organization.id, role: "viewer", isActive: false } });
      expect(await membershipsOf(invitee)).toEqual([expect.objectContaining({ role: "viewer" })]);
    });

    it("refuses a member who confirmed another address and leaves the invitation pending", async () => {
      const { organization, invite, seedInvitee, request, membershipsOf } = await setup({});
      const member = await seedInvitee();
      await seedOrganizationMember({ organizationId: organization.id, userId: member.id, role: "viewer" });
      const { token, invitation } = await invite({ email: "jane@example.com", role: "admin" });

      const response = await request("/v1/invitations/accept", { asUser: member, body: { data: { token, confirmEmailMismatch: true } } });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "already_member" });
      expect(await membershipsOf(member)).toEqual([expect.objectContaining({ role: "viewer" })]);
      expect(await invitationOf(invitation.id)).toMatchObject({ status: "pending", acceptedByUserId: null });
    });

    it("refuses an API key and writes nothing", async () => {
      const { invite, seedInvitee, seedApiKey, request, membershipsOf, userOf } = await setup({});
      const invitee = await seedInvitee();
      const apiKey = await seedApiKey(invitee);
      const { token, invitation } = await invite({ email: invitee.email!, role: "admin" });

      const response = await request("/v1/invitations/accept", { apiKey, body: { data: { token } } });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "session_required" });
      expect(await membershipsOf(invitee)).toEqual([]);
      expect(await userOf(invitee)).toMatchObject({ lastUsedOrganizationId: null });
      expect(await invitationOf(invitation.id)).toMatchObject({ status: "pending", acceptedByUserId: null });
    });

    it("asks an invitee whose matching email is not verified to confirm", async () => {
      const { invite, seedInvitee, request, membershipsOf } = await setup({});
      const invitee = await seedInvitee({ emailVerified: false });
      const { token } = await invite({ email: invitee.email!, role: "member" });

      const response = await request("/v1/invitations/accept", { asUser: invitee, body: { data: { token } } });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "invitation_email_mismatch" });
      expect(await membershipsOf(invitee)).toEqual([]);
    });

    it("refuses a signed-out caller", async () => {
      const { invite, request } = await setup({});
      const { token } = await invite({});

      const response = await request("/v1/invitations/accept", { body: { data: { token } } });

      expect(response.status).toBe(401);
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { invite, seedInvitee, request, membershipsOf } = await setup({ organizationsOn: false });
      const invitee = await seedInvitee();
      const { token } = await invite({ email: invitee.email! });

      const response = await request("/v1/invitations/accept", { asUser: invitee, body: { data: { token } } });

      expect(response.status).toBe(404);
      expect(await membershipsOf(invitee)).toEqual([]);
    });

    it("rejects a token that is not an invitation token", async () => {
      const { seedInvitee, request } = await setup({});
      const invitee = await seedInvitee();

      const response = await request("/v1/invitations/accept", { asUser: invitee, body: { data: { token: `${createInvitationToken()}=` } } });

      expect(response.status).toBe(400);
    });
  });

  async function invitationOf(id: string) {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const OrganizationInvitations = resolveTable("OrganizationInvitations");
    const [invitation] = await db.select().from(OrganizationInvitations).where(eq(OrganizationInvitations.id, id));

    return invitation;
  }

  async function countMembers(organizationId: string, role: string) {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const OrganizationMembers = resolveTable("OrganizationMembers");
    const members = await db.select().from(OrganizationMembers).where(eq(OrganizationMembers.organizationId, organizationId));

    return members.filter(member => member.role === role).length;
  }

  async function setup(input: { organizationsOn?: boolean }) {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const OrganizationMembers = resolveTable("OrganizationMembers");
    const ProjectMembers = resolveTable("ProjectMembers");
    const Users = resolveTable("Users");
    const externalUserIdByToken = new Map<string, string>();
    const bearerByUserId = new Map<string, string>();
    const personalOrganizationIdByUserId = new Map<string, string>();
    const { organization, user: owner } = await seedOrganizationWithOwner({
      user: { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `owner-${faker.string.alphanumeric(12)}` }
    });
    const project = await seedProject({ organizationId: organization.id });

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => externalUserIdByToken.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return input.organizationsOn !== false;
    });

    async function seedInvitee(overrides: { email?: string; emailVerified?: boolean } = {}) {
      const user = await seedUser({
        userId: `auth0|${faker.string.alphanumeric(24)}`,
        username: `user-${faker.string.alphanumeric(12)}`,
        email: overrides.email ?? faker.internet.email().toLowerCase(),
        emailVerified: overrides.emailVerified ?? true
      });
      const personal = await seedOrganization({ type: "personal", createdByUserId: user.id });
      await seedOrganizationMember({ organizationId: personal.id, userId: user.id, role: "owner" });
      const bearer = faker.string.alphanumeric(40);
      externalUserIdByToken.set(bearer, user.userId!);
      bearerByUserId.set(user.id, bearer);
      personalOrganizationIdByUserId.set(user.id, personal.id);

      return user;
    }

    async function invite(overrides: Partial<OrganizationInvitationInput>) {
      const token = createInvitationToken();
      const invitation = await seedOrganizationInvitation({
        organizationId: organization.id,
        invitedByUserId: owner.id,
        ...overrides,
        tokenHash: hashInvitationToken(token)
      });

      return { token, invitation };
    }

    async function request(path: string, options: { asUser?: UserOutput; apiKey?: string; organizationId?: string; body: unknown }) {
      const headers: Record<string, string> = { "content-type": "application/json" };

      if (options.asUser) {
        headers.authorization = `Bearer ${bearerByUserId.get(options.asUser.id)}`;
      }

      if (options.apiKey) {
        headers["x-api-key"] = options.apiKey;
      }

      if (options.organizationId) {
        headers["x-organization-id"] = options.organizationId;
      }

      return await app.request(path, { method: "POST", headers, body: JSON.stringify(options.body) });
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

    return { organization, project, owner, invite, seedInvitee, seedApiKey, request, membershipsOf, grantsOf, userOf };
  }
});
