import { faker } from "@faker-js/faker";
import { addDays, differenceInSeconds } from "date-fns";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { JOB_NAME } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { hashInvitationToken } from "@src/organization/lib/invitation-token/invitation-token";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import {
  type OrganizationInvitationOutput,
  OrganizationInvitationRepository
} from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import { INVITATION_EMAIL_LIMITS } from "@src/organization/services/invitation-email-limiter/invitation-email-limiter.service";
import { MAX_PENDING_INVITATIONS_PER_ORGANIZATION } from "@src/organization/services/organization-invitation/organization-invitation.service";
import { OrganizationInvitationEmailJob } from "@src/organization/services/organization-invitation-email/organization-invitation-email.handler";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";

import {
  seedOrganization,
  seedOrganizationInvitation,
  seedOrganizationInvitationEmail,
  seedOrganizationMember,
  seedProject
} from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { findJobRows } from "@test/services/job-queue-harness";

const EMAIL_JOB = OrganizationInvitationEmailJob[JOB_NAME];

const UNAVAILABLE_INVITATIONS = [
  { case: "a revoked invitation", seed: (organizationId: string) => seedOrganizationInvitation({ organizationId, status: "revoked" }) },
  { case: "an accepted invitation", seed: (organizationId: string) => seedOrganizationInvitation({ organizationId, status: "accepted" }) },
  { case: "an invitation of another organization", seed: async () => seedOrganizationInvitation({ organizationId: (await seedOrganization()).id }) }
];

describe("Organization invitations", () => {
  const invitationRepository = container.resolve(OrganizationInvitationRepository);

  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/organization-invitations", () => {
    it.each<OrganizationRole>(["owner", "admin"])("lists the pending invitations of the active organization to a caller with role %s", async role => {
      const { organization, owner, caller, request } = await setup({ callerRole: role });
      const pending = await seedOrganizationInvitation({ organizationId: organization.id, invitedByUserId: owner.id, role: "owner" });
      const expired = await seedOrganizationInvitation({ organizationId: organization.id, invitedByUserId: null, expiresAt: addDays(new Date(), -1) });
      await seedOrganizationInvitation({ organizationId: organization.id, status: "revoked" });
      await seedOrganizationInvitation({ organizationId: organization.id, status: "accepted" });
      await seedOrganizationInvitation({ organizationId: (await seedOrganization()).id });

      const response = await request("GET", "/v1/organization-invitations", { asUser: caller, organizationId: organization.id });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: [
          { ...toOutput(pending), invitedBy: { id: owner.id, username: owner.username } },
          { ...toOutput(expired), invitedBy: null }
        ].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      });
    });

    it.each<OrganizationRole>(["member", "billing", "viewer"])("refuses a caller with role %s", async role => {
      const { organization, caller, request } = await setup({ callerRole: role });

      const response = await request("GET", "/v1/organization-invitations", { asUser: caller, organizationId: organization.id });

      expect(response.status).toBe(403);
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { organization, owner, request } = await setup({ callerRole: "owner", organizationsOn: false });

      const response = await request("GET", "/v1/organization-invitations", { asUser: owner, organizationId: organization.id });

      expect(response.status).toBe(404);
    });
  });

  describe("POST /v1/organization-invitations", () => {
    it.each<OrganizationRole>(["owner", "admin"])("lets a caller with role %s invite people and queues an email for each", async role => {
      const { organization, caller, request } = await setup({ callerRole: role });
      const project = await seedProject({ organizationId: organization.id });
      const projectGrants = [{ projectId: project.id, role: "viewer" }];

      const response = await request("POST", "/v1/organization-invitations", {
        asUser: caller,
        organizationId: organization.id,
        body: { data: { emails: [" Jane@Example.com", "joe@example.com", "jane@example.com"], role: "admin", projectGrants } }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string; email: string; expiresAt: string }[] };
      expect(data).toEqual(
        ["jane@example.com", "joe@example.com"].map(email => ({
          id: expect.any(String),
          email,
          role: "admin",
          projectGrants,
          invitedBy: { id: caller.id, username: caller.username },
          createdAt: expect.any(String),
          expiresAt: expect.any(String)
        }))
      );
      expect(differenceInSeconds(new Date(data[0].expiresAt), addDays(new Date(), 7))).toBeLessThanOrEqual(0);
      expect(differenceInSeconds(new Date(data[0].expiresAt), addDays(new Date(), 7))).toBeGreaterThan(-60);
      for (const invitation of data) {
        const stored = await invitationRepository.findById(invitation.id);
        expect(stored).toMatchObject({
          organizationId: organization.id,
          status: "pending",
          invitedByUserId: caller.id,
          tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/)
        });
        expect(await findJobRows(EMAIL_JOB, { data: { invitationId: invitation.id } })).toEqual([
          expect.objectContaining({ data: expect.objectContaining({ invitationId: invitation.id, tokenHash: stored!.tokenHash }) })
        ]);
      }
    });

    it.each<OrganizationRole>(["member", "billing", "viewer"])("refuses a caller with role %s", async role => {
      const { organization, caller, request } = await setup({ callerRole: role });
      const email = faker.internet.email().toLowerCase();

      const response = await request("POST", "/v1/organization-invitations", {
        asUser: caller,
        organizationId: organization.id,
        body: { data: { emails: [email], role: "member" } }
      });

      expect(response.status).toBe(403);
      expect(await invitationRepository.count({ organizationId: organization.id, email })).toBe(0);
    });

    it("lets an owner invite someone as an owner", async () => {
      const { organization, owner, request } = await setup({ callerRole: "owner" });

      const response = await request("POST", "/v1/organization-invitations", {
        asUser: owner,
        organizationId: organization.id,
        body: { data: { emails: ["jane@example.com"], role: "owner" } }
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ data: [{ email: "jane@example.com", role: "owner" }] });
    });

    it("refuses to let an admin invite someone as an owner", async () => {
      const { organization, caller, request } = await setup({ callerRole: "admin" });

      const response = await request("POST", "/v1/organization-invitations", {
        asUser: caller,
        organizationId: organization.id,
        body: { data: { emails: ["jane@example.com"], role: "owner" } }
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "owner_role_restricted" });
      expect(await invitationRepository.count({ organizationId: organization.id })).toBe(0);
    });

    it("returns the pending invitation of an address invited again without creating or emailing another", async () => {
      const { organization, owner, request } = await setup({ callerRole: "owner" });
      const pending = await seedOrganizationInvitation({
        organizationId: organization.id,
        email: "jane@example.com",
        role: "viewer",
        invitedByUserId: owner.id
      });

      const response = await request("POST", "/v1/organization-invitations", {
        asUser: owner,
        organizationId: organization.id,
        body: { data: { emails: ["JANE@example.com"], role: "admin" } }
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ data: [{ ...toOutput(pending), invitedBy: { id: owner.id, username: owner.username } }] });
      expect(await invitationRepository.count({ organizationId: organization.id, email: "jane@example.com" })).toBe(1);
      expect(await findJobRows(EMAIL_JOB, { data: { invitationId: pending.id } })).toEqual([]);
    });

    it("renews and emails again an address whose invitation expired", async () => {
      const { organization, owner, request } = await setup({ callerRole: "owner" });
      const expired = await seedOrganizationInvitation({
        organizationId: organization.id,
        email: "jane@example.com",
        role: "viewer",
        expiresAt: addDays(new Date(), -1)
      });

      const response = await request("POST", "/v1/organization-invitations", {
        asUser: owner,
        organizationId: organization.id,
        body: { data: { emails: ["jane@example.com"], role: "admin" } }
      });

      expect(response.status).toBe(201);
      const stored = await invitationRepository.findById(expired.id);
      expect(await response.json()).toMatchObject({ data: [{ id: expired.id, role: "viewer", expiresAt: stored!.expiresAt.toISOString() }] });
      expect(differenceInSeconds(stored!.expiresAt, addDays(new Date(), 7))).toBeGreaterThan(-60);
      expect(stored!.tokenHash).not.toBe(expired.tokenHash);
      expect(await findJobRows(EMAIL_JOB, { data: { invitationId: expired.id } })).toEqual([
        expect.objectContaining({ data: expect.objectContaining({ tokenHash: stored!.tokenHash }) })
      ]);
      expect(await invitationRepository.count({ organizationId: organization.id, email: "jane@example.com" })).toBe(1);
    });

    it("refuses an address that belongs to a member of the organization", async () => {
      const { organization, owner, target, request } = await setup({ callerRole: "owner", targetRole: "member" });

      const response = await request("POST", "/v1/organization-invitations", {
        asUser: owner,
        organizationId: organization.id,
        body: { data: { emails: [target.email!.toUpperCase(), "joe@example.com"], role: "member" } }
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "already_member" });
      expect(await invitationRepository.count({ organizationId: organization.id })).toBe(0);
    });

    it("refuses to invite into a personal organization", async () => {
      const { personal, owner, request } = await setup({ callerRole: "owner" });

      const response = await request("POST", "/v1/organization-invitations", {
        asUser: owner,
        organizationId: personal.id,
        body: { data: { emails: ["jane@example.com"], role: "member" } }
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "personal_organization" });
      expect(await invitationRepository.count({ organizationId: personal.id })).toBe(0);
    });

    it("refuses a project grant outside the active organization", async () => {
      const { organization, personal, owner, request } = await setup({ callerRole: "owner" });
      const foreignProject = await seedProject({ organizationId: personal.id });

      const response = await request("POST", "/v1/organization-invitations", {
        asUser: owner,
        organizationId: organization.id,
        body: { data: { emails: ["jane@example.com"], role: "member", projectGrants: [{ projectId: foreignProject.id, role: "admin" }] } }
      });

      expect(response.status).toBe(400);
      expect(await invitationRepository.count({ organizationId: organization.id })).toBe(0);
    });

    it.each([
      { case: "no address", data: { emails: [], role: "member" } },
      { case: "an invalid address", data: { emails: ["not-an-email"], role: "member" } },
      { case: "an unknown role", data: { emails: ["jane@example.com"], role: "superuser" } },
      { case: "too many addresses", data: { emails: Array.from({ length: 21 }, (_, index) => `user${index}@example.com`), role: "member" } }
    ])("rejects a request with $case", async ({ data }) => {
      const { organization, owner, request } = await setup({ callerRole: "owner" });

      const response = await request("POST", "/v1/organization-invitations", { asUser: owner, organizationId: organization.id, body: { data } });

      expect(response.status).toBe(400);
    });

    it("refuses invitations beyond the organization's pending invitation limit", async () => {
      const { organization, owner, request } = await setup({ callerRole: "owner" });
      await Promise.all(
        Array.from({ length: MAX_PENDING_INVITATIONS_PER_ORGANIZATION }, () => seedOrganizationInvitation({ organizationId: organization.id }))
      );

      const response = await request("POST", "/v1/organization-invitations", {
        asUser: owner,
        organizationId: organization.id,
        body: { data: { emails: ["jane@example.com"], role: "member" } }
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "invitation_limit_reached" });
      expect(await invitationRepository.count({ organizationId: organization.id, email: "jane@example.com" })).toBe(0);
    });

    it("refuses new invitations once the organization sent too many invitation emails recently", async () => {
      const { organization, owner, request } = await setup({ callerRole: "owner" });
      const earlier = await seedOrganizationInvitation({ organizationId: organization.id });
      await Promise.all(
        Array.from({ length: INVITATION_EMAIL_LIMITS.perOrganization }, () =>
          seedOrganizationInvitationEmail({ organizationId: organization.id, invitationId: earlier.id })
        )
      );

      const response = await request("POST", "/v1/organization-invitations", {
        asUser: owner,
        organizationId: organization.id,
        body: { data: { emails: ["jane@example.com"], role: "member" } }
      });

      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toMatch(/^\d+$/);
      expect(await response.json()).toMatchObject({ code: "invitation_email_limit_reached" });
      expect(await invitationRepository.count({ organizationId: organization.id, email: "jane@example.com" })).toBe(0);
    });

    it("refuses to invite an address that was emailed too often recently", async () => {
      const { organization, owner, request } = await setup({ callerRole: "owner" });
      const invite = () =>
        request("POST", "/v1/organization-invitations", {
          asUser: owner,
          organizationId: organization.id,
          body: { data: { emails: ["jane@example.com"], role: "member" } }
        });

      for (let round = 0; round < INVITATION_EMAIL_LIMITS.perAddress; round++) {
        const { data } = (await (await invite()).json()) as { data: { id: string }[] };
        await request("DELETE", `/v1/organization-invitations/${data[0].id}`, { asUser: owner, organizationId: organization.id });
      }
      const response = await invite();

      expect(response.status).toBe(429);
      expect(await invitationRepository.count({ organizationId: organization.id, email: "jane@example.com", status: "pending" })).toBe(0);
      expect(await invitationRepository.count({ organizationId: organization.id, email: "jane@example.com", status: "revoked" })).toBe(
        INVITATION_EMAIL_LIMITS.perAddress
      );
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { organization, owner, request } = await setup({ callerRole: "owner", organizationsOn: false });

      const response = await request("POST", "/v1/organization-invitations", {
        asUser: owner,
        organizationId: organization.id,
        body: { data: { emails: ["jane@example.com"], role: "member" } }
      });

      expect(response.status).toBe(404);
      expect(await invitationRepository.count({ organizationId: organization.id })).toBe(0);
    });
  });

  describe("POST /v1/organization-invitations/{id}/resend", () => {
    it.each<OrganizationRole>(["owner", "admin"])("lets a caller with role %s renew the token and expiry and email it again", async role => {
      const { organization, owner, caller, request } = await setup({ callerRole: role });
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id, invitedByUserId: owner.id, expiresAt: addDays(new Date(), -1) });

      const response = await request("POST", `/v1/organization-invitations/${invitation.id}/resend`, { asUser: caller, organizationId: organization.id });

      expect(response.status).toBe(200);
      const stored = await invitationRepository.findById(invitation.id);
      expect(await response.json()).toEqual({
        data: { ...toOutput({ ...invitation, expiresAt: stored!.expiresAt }), invitedBy: { id: owner.id, username: owner.username } }
      });
      expect(stored!.tokenHash).not.toBe(invitation.tokenHash);
      expect(differenceInSeconds(stored!.expiresAt, addDays(new Date(), 7))).toBeGreaterThan(-60);
      expect(await findJobRows(EMAIL_JOB, { data: { invitationId: invitation.id } })).toEqual([
        expect.objectContaining({ data: expect.objectContaining({ tokenHash: stored!.tokenHash }) })
      ]);
    });

    it.each<OrganizationRole>(["member", "billing", "viewer"])("refuses a caller with role %s", async role => {
      const { organization, caller, request } = await setup({ callerRole: role });
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });

      const response = await request("POST", `/v1/organization-invitations/${invitation.id}/resend`, { asUser: caller, organizationId: organization.id });

      expect(response.status).toBe(403);
      expect(await invitationRepository.findById(invitation.id)).toMatchObject({ tokenHash: invitation.tokenHash });
    });

    it("refuses to let an admin resend an invitation to become an owner", async () => {
      const { organization, caller, request } = await setup({ callerRole: "admin" });
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id, role: "owner" });

      const response = await request("POST", `/v1/organization-invitations/${invitation.id}/resend`, { asUser: caller, organizationId: organization.id });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "owner_role_restricted" });
    });

    it.each(UNAVAILABLE_INVITATIONS)("answers not found for $case", async ({ seed }) => {
      const { organization, owner, request } = await setup({ callerRole: "owner" });
      const invitation = await seed(organization.id);

      const response = await request("POST", `/v1/organization-invitations/${invitation.id}/resend`, { asUser: owner, organizationId: organization.id });

      expect(response.status).toBe(404);
      expect(await invitationRepository.findById(invitation.id)).toMatchObject({ tokenHash: invitation.tokenHash });
    });

    it("refuses to resend once the address was emailed too often recently", async () => {
      const { organization, owner, request } = await setup({ callerRole: "owner" });
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });
      const resend = () => request("POST", `/v1/organization-invitations/${invitation.id}/resend`, { asUser: owner, organizationId: organization.id });

      const allowed = [];
      for (let round = 0; round < INVITATION_EMAIL_LIMITS.perAddress; round++) {
        allowed.push((await resend()).status);
      }
      const tokenHashBefore = (await invitationRepository.findById(invitation.id))!.tokenHash;
      const refused = await resend();

      expect(allowed).toEqual(Array(INVITATION_EMAIL_LIMITS.perAddress).fill(200));
      expect(refused.status).toBe(429);
      expect(await refused.json()).toMatchObject({ code: "invitation_email_limit_reached" });
      expect(await invitationRepository.findById(invitation.id)).toMatchObject({ tokenHash: tokenHashBefore });
      expect(await findJobRows(EMAIL_JOB, { data: { invitationId: invitation.id } })).toHaveLength(INVITATION_EMAIL_LIMITS.perAddress);
    });
  });

  describe("POST /v1/organization-invitations/{id}/link", () => {
    it.each<OrganizationRole>(["owner", "admin"])("lets a caller with role %s get a new link that replaces every earlier one", async role => {
      const { organization, caller, request } = await setup({ callerRole: role });
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });
      const deployWebBaseUrl = container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL");

      const first = await request("POST", `/v1/organization-invitations/${invitation.id}/link`, { asUser: caller, organizationId: organization.id });
      const firstToken = tokenOf(await first.json(), deployWebBaseUrl);
      const second = await request("POST", `/v1/organization-invitations/${invitation.id}/link`, { asUser: caller, organizationId: organization.id });
      const secondToken = tokenOf(await second.json(), deployWebBaseUrl);

      expect([first.status, second.status]).toEqual([200, 200]);
      expect(firstToken).not.toBe(secondToken);
      expect(await invitationRepository.findById(invitation.id)).toMatchObject({
        tokenHash: hashInvitationToken(secondToken),
        expiresAt: invitation.expiresAt
      });
      expect(await findJobRows(EMAIL_JOB, { data: { invitationId: invitation.id } })).toEqual([]);
    });

    it("gives an expired invitation a new expiry along with the link", async () => {
      const { organization, owner, request } = await setup({ callerRole: "owner" });
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id, expiresAt: addDays(new Date(), -1) });

      const response = await request("POST", `/v1/organization-invitations/${invitation.id}/link`, { asUser: owner, organizationId: organization.id });

      expect(response.status).toBe(200);
      const stored = await invitationRepository.findById(invitation.id);
      expect(differenceInSeconds(stored!.expiresAt, addDays(new Date(), 7))).toBeGreaterThan(-60);
    });

    it.each<OrganizationRole>(["member", "billing", "viewer"])("refuses a caller with role %s", async role => {
      const { organization, caller, request } = await setup({ callerRole: role });
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });

      const response = await request("POST", `/v1/organization-invitations/${invitation.id}/link`, { asUser: caller, organizationId: organization.id });

      expect(response.status).toBe(403);
      expect(await invitationRepository.findById(invitation.id)).toMatchObject({ tokenHash: invitation.tokenHash });
    });

    it("refuses to let an admin link to an invitation to become an owner", async () => {
      const { organization, caller, request } = await setup({ callerRole: "admin" });
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id, role: "owner" });

      const response = await request("POST", `/v1/organization-invitations/${invitation.id}/link`, { asUser: caller, organizationId: organization.id });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "owner_role_restricted" });
      expect(await invitationRepository.findById(invitation.id)).toMatchObject({ tokenHash: invitation.tokenHash });
    });

    it.each(UNAVAILABLE_INVITATIONS)("answers not found for $case", async ({ seed }) => {
      const { organization, owner, request } = await setup({ callerRole: "owner" });
      const invitation = await seed(organization.id);

      const response = await request("POST", `/v1/organization-invitations/${invitation.id}/link`, { asUser: owner, organizationId: organization.id });

      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain("#token=");
      expect(await invitationRepository.findById(invitation.id)).toMatchObject({ tokenHash: invitation.tokenHash });
    });
  });

  describe("DELETE /v1/organization-invitations/{id}", () => {
    it.each<OrganizationRole>(["owner", "admin"])("lets a caller with role %s revoke an invitation", async role => {
      const { organization, caller, request } = await setup({ callerRole: role });
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });

      const response = await request("DELETE", `/v1/organization-invitations/${invitation.id}`, { asUser: caller, organizationId: organization.id });

      expect(response.status).toBe(204);
      expect(await invitationRepository.findById(invitation.id)).toMatchObject({ status: "revoked", revokedAt: expect.any(Date) });
    });

    it.each<OrganizationRole>(["member", "billing", "viewer"])("refuses a caller with role %s", async role => {
      const { organization, caller, request } = await setup({ callerRole: role });
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id });

      const response = await request("DELETE", `/v1/organization-invitations/${invitation.id}`, { asUser: caller, organizationId: organization.id });

      expect(response.status).toBe(403);
      expect(await invitationRepository.findById(invitation.id)).toMatchObject({ status: "pending" });
    });

    it("refuses to let an admin revoke an invitation to become an owner", async () => {
      const { organization, caller, request } = await setup({ callerRole: "admin" });
      const invitation = await seedOrganizationInvitation({ organizationId: organization.id, role: "owner" });

      const response = await request("DELETE", `/v1/organization-invitations/${invitation.id}`, { asUser: caller, organizationId: organization.id });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "owner_role_restricted" });
      expect(await invitationRepository.findById(invitation.id)).toMatchObject({ status: "pending" });
    });

    it("answers not found for an invitation of another organization", async () => {
      const { organization, owner, request } = await setup({ callerRole: "owner" });
      const invitation = await seedOrganizationInvitation({ organizationId: (await seedOrganization()).id });

      const response = await request("DELETE", `/v1/organization-invitations/${invitation.id}`, { asUser: owner, organizationId: organization.id });

      expect(response.status).toBe(404);
      expect(await invitationRepository.findById(invitation.id)).toMatchObject({ status: "pending" });
    });
  });

  function toOutput(invitation: OrganizationInvitationOutput) {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      projectGrants: invitation.projectGrants,
      createdAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt.toISOString()
    };
  }

  function tokenOf(body: unknown, deployWebBaseUrl: string) {
    const { url } = (body as { data: { url: string } }).data;
    expect(url).toMatch(new RegExp(`^${deployWebBaseUrl}/invitations#token=[A-Za-z0-9_-]{43}$`));

    return url.replace(`${deployWebBaseUrl}/invitations#token=`, "");
  }

  async function setup(input: { callerRole: OrganizationRole; targetRole?: OrganizationRole; organizationsOn?: boolean }) {
    const externalUserIdByToken = new Map<string, string>();
    const tokenByUserId = new Map<string, string>();
    const owner = await seedSignedInUser();
    const organization = await seedOrganization({ createdByUserId: owner.id });
    const personal = await seedOrganization({ type: "personal", createdByUserId: owner.id });
    await seedOrganizationMember({ organizationId: personal.id, userId: owner.id, role: "owner" });
    await seedOrganizationMember({ organizationId: organization.id, userId: owner.id, role: "owner" });
    const caller = input.callerRole === "owner" ? owner : await seedMembership(await seedSignedInUser(), input.callerRole);
    const target = await seedSignedInUser();

    if (input.targetRole) {
      await seedMembership(target, input.targetRole);
    }

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => externalUserIdByToken.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return input.organizationsOn !== false;
    });

    async function seedSignedInUser() {
      const user = await seedUser({
        userId: `auth0|${faker.string.alphanumeric(24)}`,
        username: `user-${faker.string.alphanumeric(12)}`,
        email: faker.internet.email().toLowerCase()
      });
      const token = faker.string.alphanumeric(40);
      externalUserIdByToken.set(token, user.userId!);
      tokenByUserId.set(user.id, token);

      return user;
    }

    async function seedMembership(user: UserOutput, role: OrganizationRole) {
      await seedOrganizationMember({ organizationId: organization.id, userId: user.id, role });

      return user;
    }

    async function request(method: string, path: string, options: { asUser: UserOutput; organizationId: string; body?: unknown }) {
      const headers = { authorization: `Bearer ${tokenByUserId.get(options.asUser.id)}`, "x-organization-id": options.organizationId };

      if (options.body === undefined) {
        return await app.request(path, { method, headers });
      }

      return await app.request(path, { method, headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(options.body) });
    }

    return { organization, personal, owner, caller, target, request };
  }
});
