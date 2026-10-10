import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { setTimeout as delay } from "node:timers/promises";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { createInvitationToken, hashInvitationToken } from "@src/organization/lib/invitation-token/invitation-token";
import type { ProjectGrant } from "@src/organization/model-schemas/organization-invitation/organization-invitation.schema";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { OrganizationInvitationRepository } from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { INVITATION_ALREADY_ACCEPTED_ERROR_CODE, INVITATION_REVOKED_ERROR_CODE, InvitationAcceptanceService } from "./invitation-acceptance.service";

import {
  seedOrganization,
  seedOrganizationInvitation,
  seedOrganizationInvitationEmail,
  seedOrganizationMember,
  seedOrganizationWithOwner,
  seedProject
} from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

describe(InvitationAcceptanceService.name, () => {
  describe("acceptInvitation", () => {
    it("joins a user acting in their personal organization to the invited one with its role and live project grants", async () => {
      const { service, organization, project, invite, seedInvitee, runAs, grantsOf } = await setup();
      const deletedProject = await seedProject({ organizationId: organization.id, deletedAt: new Date() });
      const invitee = await seedInvitee();
      const { token, invitation } = await invite({
        email: invitee.email!,
        role: "member",
        projectGrants: [
          { projectId: project.id, role: "viewer" },
          { projectId: deletedProject.id, role: "admin" }
        ]
      });

      const joined = await runAs(invitee, () => service.acceptInvitation({ token }));

      expect(joined).toMatchObject({ role: "member", organization: { id: organization.id }, isActive: false });
      expect(await container.resolve(OrganizationMemberRepository).find({ organizationId: organization.id, userId: invitee.id })).toEqual([
        expect.objectContaining({ role: "member" })
      ]);
      expect(await grantsOf(invitee)).toEqual([expect.objectContaining({ projectId: project.id, role: "viewer" })]);
      expect(await container.resolve(OrganizationInvitationRepository).findById(invitation.id)).toMatchObject({
        status: "accepted",
        acceptedByUserId: invitee.id,
        acceptedAt: expect.any(Date)
      });
      expect(await container.resolve(UserRepository).findById(invitee.id)).toMatchObject({ lastUsedOrganizationId: organization.id });
    });

    it("lets exactly one of several users racing the same link join", async () => {
      const { service, organization, invite, seedInvitee, runAs } = await setup();
      const invitees = await Promise.all(Array.from({ length: 4 }, () => seedInvitee()));
      const { token, invitation } = await invite({ email: "jane@example.com", role: "member" });

      const outcomes = await Promise.allSettled(invitees.map(invitee => runAs(invitee, () => service.acceptInvitation({ token, confirmEmailMismatch: true }))));

      expect(outcomes.filter(outcome => outcome.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter(outcome => outcome.status === "rejected")).toEqual(
        Array.from({ length: 3 }, () =>
          expect.objectContaining({ reason: expect.objectContaining({ status: 409, errorCode: INVITATION_ALREADY_ACCEPTED_ERROR_CODE }) })
        )
      );
      const members = await container.resolve(OrganizationMemberRepository).find({ organizationId: organization.id, role: "member" });
      expect(members).toHaveLength(1);
      expect(await container.resolve(OrganizationInvitationRepository).findById(invitation.id)).toMatchObject({ acceptedByUserId: members[0].userId });
    });

    it("keeps one membership and one grant when the same user submits the acceptance several times at once", async () => {
      const { service, organization, project, invite, seedInvitee, runAs, grantsOf } = await setup();
      const invitee = await seedInvitee();
      const { token } = await invite({ email: invitee.email!, role: "admin", projectGrants: [{ projectId: project.id, role: "member" }] });

      const results = await Promise.all(Array.from({ length: 5 }, () => runAs(invitee, () => service.acceptInvitation({ token }))));

      expect(results.map(result => result.organization.id)).toEqual(Array(5).fill(organization.id));
      expect(await container.resolve(OrganizationMemberRepository).count({ organizationId: organization.id, userId: invitee.id })).toBe(1);
      expect(await grantsOf(invitee)).toHaveLength(1);
    });

    it("keeps one membership when a user accepts two invitations of the same organization at once", async () => {
      const { service, organization, invite, seedInvitee, runAs } = await setup();
      const invitee = await seedInvitee();
      const invitations = await Promise.all([invite({ email: invitee.email!, role: "member" }), invite({ email: "joe@example.com", role: "member" })]);

      await Promise.all(invitations.map(({ token }) => runAs(invitee, () => service.acceptInvitation({ token, confirmEmailMismatch: true }))));

      expect(await container.resolve(OrganizationMemberRepository).count({ organizationId: organization.id, userId: invitee.id })).toBe(1);
      expect(await container.resolve(OrganizationInvitationRepository).count({ organizationId: organization.id, acceptedByUserId: invitee.id })).toBe(2);
    });

    it("waits for an invitation write holding the organization row and sees its outcome", async () => {
      const { service, organization, invite, seedInvitee, runAs, txService } = await setup();
      const invitee = await seedInvitee();
      const { token, invitation } = await invite({ email: invitee.email!, role: "member" });

      const revocation = txService.transaction(async () => {
        await container.resolve(OrganizationRepository).findOneByAndLock({ id: organization.id }, { strength: "no key update" });
        await delay(200);
        await container.resolve(OrganizationInvitationRepository).updateById(invitation.id, { status: "revoked", revokedAt: new Date() });
      });
      await delay(50);
      const acceptance = runAs(invitee, () => service.acceptInvitation({ token }));

      await revocation;
      await expect(acceptance).rejects.toMatchObject({ status: 410, errorCode: INVITATION_REVOKED_ERROR_CODE });
      expect(await container.resolve(OrganizationMemberRepository).count({ organizationId: organization.id, userId: invitee.id })).toBe(0);
    });

    it("leaves rows referencing the organization or the invitation writable while an acceptance holds its locks", async () => {
      const { service, organization, owner, invite, seedInvitee, runAs, txService } = await setup();
      const invitee = await seedInvitee();
      const { token, invitation } = await invite({ email: invitee.email!, role: "member" });
      const events: string[] = [];

      const acceptance = runAs(invitee, () =>
        txService.transaction(async () => {
          await service.acceptInvitation({ token });
          await delay(300);
          events.push("acceptance committed");
        })
      );
      await delay(100);
      await container.resolve(UserRepository).updateById(owner.id, { lastUsedOrganizationId: organization.id });
      await seedOrganizationInvitationEmail({ organizationId: organization.id, invitationId: invitation.id, sentByUserId: owner.id });
      events.push("referencing rows written");
      await acceptance;

      expect(events).toEqual(["referencing rows written", "acceptance committed"]);
    });

    it("answers not found for an invitation of a deleted organization", async () => {
      const { service, organization, invite, seedInvitee, runAs } = await setup();
      const invitee = await seedInvitee();
      const { token } = await invite({ email: invitee.email!, role: "member" });
      await container.resolve(OrganizationRepository).updateById(organization.id, { deletedAt: new Date() });

      await expect(runAs(invitee, () => service.acceptInvitation({ token }))).rejects.toMatchObject({ status: 404 });
      expect(await container.resolve(OrganizationMemberRepository).count({ organizationId: organization.id, userId: invitee.id })).toBe(0);
    });

    it("keeps the role of an invitee who already belongs to the organization", async () => {
      const { service, organization, invite, seedInvitee, runAs } = await setup();
      const invitee = await seedInvitee();
      await seedOrganizationMember({ organizationId: organization.id, userId: invitee.id, role: "viewer" });
      const { token } = await invite({ email: invitee.email!, role: "admin" });

      await expect(runAs(invitee, () => service.acceptInvitation({ token }))).resolves.toMatchObject({ role: "viewer" });
      expect(await container.resolve(OrganizationMemberRepository).find({ organizationId: organization.id, userId: invitee.id })).toEqual([
        expect.objectContaining({ role: "viewer" })
      ]);
    });
  });

  async function setup() {
    const service = container.resolve(InvitationAcceptanceService);
    const txService = container.resolve(TxService);
    const executionContextService = container.resolve(ExecutionContextService);
    const abilityService = container.resolve(AbilityService);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const ProjectMembers = resolveTable("ProjectMembers");
    const { organization, project, user: owner } = await seedOrganizationWithOwner();
    const personalOrganizationIds = new Map<string, string>();

    async function seedInvitee() {
      const user = await seedUser({ userId: `auth0|${faker.string.alphanumeric(24)}`, email: faker.internet.email().toLowerCase(), emailVerified: true });
      const personal = await seedOrganization({ type: "personal", createdByUserId: user.id });
      await seedOrganizationMember({ organizationId: personal.id, userId: user.id, role: "owner" });
      personalOrganizationIds.set(user.id, personal.id);

      return user;
    }

    async function invite(input: { email: string; role: OrganizationRole; projectGrants?: ProjectGrant[] }) {
      const token = createInvitationToken();
      const invitation = await seedOrganizationInvitation({
        organizationId: organization.id,
        invitedByUserId: owner.id,
        tokenHash: hashInvitationToken(token),
        ...input
      });

      return { token, invitation };
    }

    function runAs<R>(user: UserOutput, act: () => Promise<R>) {
      return executionContextService.runWithContext(async () => {
        executionContextService.set("CURRENT_USER", user);
        executionContextService.set(
          "ORGANIZATION_CONTEXT",
          createOrganizationContext({ organizationId: personalOrganizationIds.get(user.id), organizationType: "personal" })
        );
        executionContextService.set("ABILITY", abilityService.getAbilityFor("REGULAR_USER", user));

        return await act();
      });
    }

    async function grantsOf(user: UserOutput) {
      return await db.select().from(ProjectMembers).where(eq(ProjectMembers.userId, user.id));
    }

    return { service, txService, organization, owner, project, invite, seedInvitee, runAs, grantsOf };
  }
});
