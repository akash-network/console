import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { type OrganizationMemberOutput, OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganization, seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe("Organization members", () => {
  const memberRepository = container.resolve(OrganizationMemberRepository);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/organization-members", () => {
    it.each<OrganizationRole>(["owner", "admin", "member", "billing", "viewer"])(
      "lists the members of the active organization to a caller with role %s",
      async role => {
        const { organization, owner, caller, target, membershipOf, request } = await setup({ callerRole: role, targetRole: "viewer" });
        await seedOrganizationWithOwner();

        const response = await request("GET", "/v1/organization-members", { asUser: caller, organizationId: organization.id });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          data: [...new Set([owner, caller, target])].map(user => ({
            id: membershipOf(user).id,
            userId: user.id,
            username: user.username,
            email: user.email,
            role: membershipOf(user).role,
            createdAt: membershipOf(user).createdAt.toISOString()
          }))
        });
      }
    );

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { organization, owner, request } = await setup({ callerRole: "owner", organizationsOn: false });

      const response = await request("GET", "/v1/organization-members", { asUser: owner, organizationId: organization.id });

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /v1/organization-members/{id}", () => {
    it.each<OrganizationRole>(["owner", "admin"])("lets a caller with role %s change the role of a member", async role => {
      const { organization, caller, target, membershipOf, request } = await setup({ callerRole: role, targetRole: "member" });

      const response = await request("PATCH", `/v1/organization-members/${membershipOf(target).id}`, {
        asUser: caller,
        organizationId: organization.id,
        body: { data: { role: "admin" } }
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          id: membershipOf(target).id,
          userId: target.id,
          username: target.username,
          email: target.email,
          role: "admin",
          createdAt: membershipOf(target).createdAt.toISOString()
        }
      });
      expect(await memberRepository.findById(membershipOf(target).id)).toMatchObject({ role: "admin" });
    });

    it.each<OrganizationRole>(["member", "billing", "viewer"])("refuses a caller with role %s", async role => {
      const { organization, caller, target, membershipOf, request } = await setup({ callerRole: role, targetRole: "member" });

      const response = await request("PATCH", `/v1/organization-members/${membershipOf(target).id}`, {
        asUser: caller,
        organizationId: organization.id,
        body: { data: { role: "admin" } }
      });

      expect(response.status).toBe(403);
      expect(await memberRepository.findById(membershipOf(target).id)).toMatchObject({ role: "member" });
    });

    it("lets an owner promote a member to owner", async () => {
      const { organization, owner, target, membershipOf, request } = await setup({ callerRole: "owner", targetRole: "member" });

      const response = await request("PATCH", `/v1/organization-members/${membershipOf(target).id}`, {
        asUser: owner,
        organizationId: organization.id,
        body: { data: { role: "owner" } }
      });

      expect(response.status).toBe(200);
      expect(await memberRepository.findById(membershipOf(target).id)).toMatchObject({ role: "owner" });
    });

    it("refuses to let an admin promote a member to owner", async () => {
      const { organization, caller, target, membershipOf, request } = await setup({ callerRole: "admin", targetRole: "member" });

      const response = await request("PATCH", `/v1/organization-members/${membershipOf(target).id}`, {
        asUser: caller,
        organizationId: organization.id,
        body: { data: { role: "owner" } }
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "owner_role_restricted" });
      expect(await memberRepository.findById(membershipOf(target).id)).toMatchObject({ role: "member" });
    });

    it("refuses to let an admin change an owner", async () => {
      const { organization, owner, caller, membershipOf, request } = await setup({ callerRole: "admin" });

      const response = await request("PATCH", `/v1/organization-members/${membershipOf(owner).id}`, {
        asUser: caller,
        organizationId: organization.id,
        body: { data: { role: "member" } }
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "owner_role_restricted" });
      expect(await memberRepository.findById(membershipOf(owner).id)).toMatchObject({ role: "owner" });
    });

    it("refuses to demote the last owner", async () => {
      const { organization, owner, membershipOf, request } = await setup({ callerRole: "owner" });

      const response = await request("PATCH", `/v1/organization-members/${membershipOf(owner).id}`, {
        asUser: owner,
        organizationId: organization.id,
        body: { data: { role: "admin" } }
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "last_owner" });
      expect(await memberRepository.findById(membershipOf(owner).id)).toMatchObject({ role: "owner" });
    });

    it("refuses to change a member of a personal organization", async () => {
      const { personal, owner, request } = await setup({ callerRole: "owner" });
      const [personalMembership] = await memberRepository.find({ organizationId: personal.id });

      const response = await request("PATCH", `/v1/organization-members/${personalMembership.id}`, {
        asUser: owner,
        organizationId: personal.id,
        body: { data: { role: "admin" } }
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "personal_organization" });
    });

    it("answers not found for a member of another organization", async () => {
      const { organization, owner, request } = await setup({ callerRole: "owner" });
      const { membership: foreign } = await seedOrganizationWithOwner();

      const response = await request("PATCH", `/v1/organization-members/${foreign.id}`, {
        asUser: owner,
        organizationId: organization.id,
        body: { data: { role: "member" } }
      });

      expect(response.status).toBe(404);
      expect(await memberRepository.findById(foreign.id)).toMatchObject({ role: "owner" });
    });

    it("rejects an unknown role", async () => {
      const { organization, owner, target, membershipOf, request } = await setup({ callerRole: "owner", targetRole: "member" });

      const response = await request("PATCH", `/v1/organization-members/${membershipOf(target).id}`, {
        asUser: owner,
        organizationId: organization.id,
        body: { data: { role: "superuser" } }
      });

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /v1/organization-members/{id}", () => {
    it.each<OrganizationRole>(["owner", "admin"])("lets a caller with role %s remove a member, who then loses access to the organization", async role => {
      const { organization, caller, target, membershipOf, request } = await setup({ callerRole: role, targetRole: "member" });

      const response = await request("DELETE", `/v1/organization-members/${membershipOf(target).id}`, { asUser: caller, organizationId: organization.id });

      expect(response.status).toBe(204);
      expect(await memberRepository.findById(membershipOf(target).id)).toBeUndefined();
      const afterRemoval = await request("GET", "/v1/organization-members", { asUser: target, organizationId: organization.id });
      expect(afterRemoval.status).toBe(403);
      expect(await afterRemoval.json()).toMatchObject({ code: "organization_forbidden" });
    });

    it.each<OrganizationRole>(["member", "billing", "viewer"])("refuses a caller with role %s", async role => {
      const { organization, caller, target, membershipOf, request } = await setup({ callerRole: role, targetRole: "member" });

      const response = await request("DELETE", `/v1/organization-members/${membershipOf(target).id}`, { asUser: caller, organizationId: organization.id });

      expect(response.status).toBe(403);
      expect(await memberRepository.findById(membershipOf(target).id)).toBeDefined();
    });

    it("refuses to let an admin remove an owner", async () => {
      const { organization, owner, caller, membershipOf, request } = await setup({ callerRole: "admin" });

      const response = await request("DELETE", `/v1/organization-members/${membershipOf(owner).id}`, { asUser: caller, organizationId: organization.id });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "owner_role_restricted" });
      expect(await memberRepository.findById(membershipOf(owner).id)).toBeDefined();
    });

    it("refuses to remove the last owner", async () => {
      const { organization, owner, membershipOf, request } = await setup({ callerRole: "owner" });

      const response = await request("DELETE", `/v1/organization-members/${membershipOf(owner).id}`, { asUser: owner, organizationId: organization.id });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "last_owner" });
    });
  });

  describe("POST /v1/organization-members/{id}/ownership-transfer", () => {
    it("makes the member the owner and the calling owner an admin", async () => {
      const { organization, owner, target, membershipOf, request } = await setup({ callerRole: "owner", targetRole: "admin" });

      const response = await request("POST", `/v1/organization-members/${membershipOf(target).id}/ownership-transfer`, {
        asUser: owner,
        organizationId: organization.id
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { id: membershipOf(target).id, userId: target.id, role: "owner" } });
      expect(await memberRepository.findById(membershipOf(target).id)).toMatchObject({ role: "owner" });
      expect(await memberRepository.findById(membershipOf(owner).id)).toMatchObject({ role: "admin" });
    });

    it("refuses an admin", async () => {
      const { organization, caller, target, membershipOf, request } = await setup({ callerRole: "admin", targetRole: "member" });

      const response = await request("POST", `/v1/organization-members/${membershipOf(target).id}/ownership-transfer`, {
        asUser: caller,
        organizationId: organization.id
      });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "owner_role_restricted" });
      expect(await memberRepository.findById(membershipOf(target).id)).toMatchObject({ role: "member" });
    });

    it("refuses a member", async () => {
      const { organization, caller, owner, membershipOf, request } = await setup({ callerRole: "member" });

      const response = await request("POST", `/v1/organization-members/${membershipOf(caller).id}/ownership-transfer`, {
        asUser: caller,
        organizationId: organization.id
      });

      expect(response.status).toBe(403);
      expect(await memberRepository.findById(membershipOf(owner).id)).toMatchObject({ role: "owner" });
    });
  });

  it.each([
    ["PATCH", "/v1/organization-members/{id}"],
    ["DELETE", "/v1/organization-members/{id}"],
    ["POST", "/v1/organization-members/{id}/ownership-transfer"]
  ])("answers %s %s like an unknown path while organizations are off for the caller", async (method, path) => {
    const { organization, owner, target, membershipOf, request } = await setup({ callerRole: "owner", targetRole: "member", organizationsOn: false });

    const response = await request(method, path.replace("{id}", membershipOf(target).id), {
      asUser: owner,
      organizationId: organization.id,
      body: { data: { role: "admin" } }
    });

    expect(response.status).toBe(404);
    expect(await memberRepository.findById(membershipOf(target).id)).toMatchObject({ role: "member" });
  });

  async function setup(input: { callerRole: OrganizationRole; targetRole?: OrganizationRole; organizationsOn?: boolean }) {
    const externalUserIdByToken = new Map<string, string>();
    const tokenByUserId = new Map<string, string>();
    const memberships = new Map<string, OrganizationMemberOutput>();
    const owner = await seedSignedInUser();
    const organization = await seedOrganization({ createdByUserId: owner.id });
    const personal = await seedOrganization({ type: "personal", createdByUserId: owner.id });
    await seedOrganizationMember({ organizationId: personal.id, userId: owner.id, role: "owner" });
    await seedMembership(owner, "owner");
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
      const user = await seedUser({ userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` });
      const token = faker.string.alphanumeric(40);
      externalUserIdByToken.set(token, user.userId!);
      tokenByUserId.set(user.id, token);

      return user;
    }

    async function seedMembership(user: UserOutput, role: OrganizationRole) {
      memberships.set(user.id, await seedOrganizationMember({ organizationId: organization.id, userId: user.id, role }));

      return user;
    }

    function membershipOf(user: UserOutput) {
      return memberships.get(user.id)!;
    }

    async function request(method: string, path: string, options: { asUser: UserOutput; organizationId: string; body?: unknown }) {
      return await app.request(path, {
        method,
        headers: {
          authorization: `Bearer ${tokenByUserId.get(options.asUser.id)}`,
          "x-organization-id": options.organizationId,
          "content-type": "application/json"
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });
    }

    return { organization, personal, owner, caller, target, membershipOf, request };
  }
});
