import { addDays } from "date-fns";
import assert from "http-assert";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { JobQueueService, TxService } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { createInvitationToken, hashInvitationToken, invitationUrl } from "@src/organization/lib/invitation-token/invitation-token";
import type { ProjectGrant } from "@src/organization/model-schemas/organization-invitation/organization-invitation.schema";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import {
  type OrganizationInvitationOutput,
  OrganizationInvitationRepository,
  type OrganizationInvitationWithInviter
} from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import { InvitationEmailLimiter } from "@src/organization/services/invitation-email-limiter/invitation-email-limiter.service";
import { OrganizationInvitationEmailJob } from "@src/organization/services/organization-invitation-email/organization-invitation-email.handler";
import { OWNER_ROLE_RESTRICTED_ERROR_CODE, PERSONAL_ORGANIZATION_ERROR_CODE } from "@src/organization/services/organization-member/organization-member.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";

export const ALREADY_MEMBER_ERROR_CODE = "already_member";
export const INVITATION_LIMIT_REACHED_ERROR_CODE = "invitation_limit_reached";

export const INVITATION_VALIDITY_IN_DAYS = 7;
export const MAX_PENDING_INVITATIONS_PER_ORGANIZATION = 100;

type InvitationAction = "read" | "create" | "update" | "delete";

export interface CreateInvitationsInput {
  emails: string[];
  role: OrganizationRole;
  projectGrants?: ProjectGrant[];
}

@singleton()
export class OrganizationInvitationService {
  constructor(
    private readonly invitationRepository: OrganizationInvitationRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService,
    private readonly jobQueueService: JobQueueService,
    private readonly deploymentConfig: DeploymentConfigService,
    private readonly emailLimiter: InvitationEmailLimiter,
    private readonly organizationRepository: OrganizationRepository
  ) {}

  async listInvitations(): Promise<OrganizationInvitationWithInviter[]> {
    const { organizationId } = this.#activeOrganization();

    return await this.#repositoryFor("read").findPendingWithInviters(organizationId);
  }

  /** An address with a live pending invitation gets it back unchanged; an expired one is renewed and emailed again. */
  async createInvitations({ emails: rawEmails, role, projectGrants = [] }: CreateInvitationsInput): Promise<OrganizationInvitationWithInviter[]> {
    const context = this.#activeTeamOrganization();
    const { organizationId } = context;
    const senderId = this.authService.currentUser.id;
    this.#assertCanInviteAs(context, role);
    const emails = [...new Set(rawEmails.map(email => email.trim().toLowerCase()))];
    await this.#assertProjectsInOrganization(organizationId, projectGrants);

    await this.txService.transaction(async () => {
      await this.organizationRepository.findOneByAndLock({ id: organizationId });
      await this.#assertNoneAreMembers(organizationId, emails);
      const pending = await this.invitationRepository.findPendingWithInviters(organizationId, { emails });
      const pendingEmails = new Set(pending.map(invitation => invitation.email));
      const newEmails = emails.filter(email => !pendingEmails.has(email));
      const expired = pending.filter(invitation => hasExpired(invitation));
      expired.forEach(invitation => this.#assertCanInviteAs(context, invitation.role));
      await this.emailLimiter.assertWithinLimits({ organizationId, senderId, emails: [...newEmails, ...expired.map(invitation => invitation.email)] });
      await this.#assertRoomForInvitations(organizationId, newEmails.length);

      const created = await this.#repositoryFor("create").createUnlessPending(
        newEmails.map(email => ({
          organizationId,
          email,
          role,
          projectGrants,
          tokenHash: unissuedTokenHash(),
          expiresAt: newExpiry(),
          invitedByUserId: senderId
        }))
      );
      const renewed: OrganizationInvitationOutput[] = [];

      for (const invitation of expired) {
        renewed.push(await this.#renew(invitation.id));
      }

      await this.#sendEmails([...created, ...renewed], senderId);
    });

    const invitations = await this.#repositoryFor("read").findPendingWithInviters(organizationId, { emails });

    return emails.flatMap(email => invitations.filter(invitation => invitation.email === email));
  }

  async resendInvitation(id: OrganizationInvitationOutput["id"]): Promise<OrganizationInvitationWithInviter> {
    const context = this.#activeTeamOrganization();

    await this.txService.transaction(async () => {
      const senderId = this.authService.currentUser.id;
      const invitation = await this.#findPendingInvitation(context, id);
      await this.emailLimiter.assertWithinLimits({ organizationId: context.organizationId, senderId, emails: [invitation.email] });
      await this.#sendEmails([await this.#renew(id)], senderId);
    });

    const [invitation] = await this.#repositoryFor("read").findPendingWithInviters(context.organizationId, { ids: [id] });
    assert(invitation, 404, "Organization invitation not found");

    return invitation;
  }

  /** An expired invitation gets a new expiry too, so the link works when it is shared. */
  async createInvitationLink(id: OrganizationInvitationOutput["id"]): Promise<string> {
    const context = this.#activeTeamOrganization();
    const invitation = await this.#findPendingInvitation(context, id);
    const token = createInvitationToken();
    const updated = await this.#repositoryFor("update").updateBy(
      { id, status: "pending" },
      { tokenHash: hashInvitationToken(token), ...(hasExpired(invitation) && { expiresAt: newExpiry() }) },
      { returning: true }
    );
    assert(updated, 404, "Organization invitation not found");

    return invitationUrl(this.deploymentConfig.get("DEPLOY_WEB_BASE_URL"), token);
  }

  async revokeInvitation(id: OrganizationInvitationOutput["id"]): Promise<void> {
    const context = this.#activeTeamOrganization();
    await this.#findPendingInvitation(context, id);
    await this.#repositoryFor("delete").updateBy({ id, status: "pending" }, { status: "revoked", revokedAt: new Date() });
  }

  async #findPendingInvitation(context: OrganizationContext, id: OrganizationInvitationOutput["id"]): Promise<OrganizationInvitationOutput> {
    const invitation = await this.#repositoryFor("read").findOneBy({ id, organizationId: context.organizationId, status: "pending" });
    assert(invitation, 404, "Organization invitation not found");
    this.#assertCanInviteAs(context, invitation.role);

    return invitation;
  }

  async #renew(id: OrganizationInvitationOutput["id"]): Promise<OrganizationInvitationOutput> {
    const renewed = await this.#repositoryFor("update").updateBy(
      { id, status: "pending" },
      { tokenHash: unissuedTokenHash(), expiresAt: newExpiry() },
      { returning: true }
    );
    assert(renewed, 404, "Organization invitation not found");

    return renewed;
  }

  async #sendEmails(invitations: OrganizationInvitationOutput[], senderId: string): Promise<void> {
    await this.emailLimiter.recordSends(invitations, senderId);

    for (const { id, tokenHash } of invitations) {
      await this.jobQueueService.enqueue(new OrganizationInvitationEmailJob({ invitationId: id, tokenHash }));
    }
  }

  #assertCanInviteAs(context: OrganizationContext, role: OrganizationRole) {
    if (role === "owner" && context.role !== "owner") {
      throw createError(403, "Only an owner can invite someone as an owner", { errorCode: OWNER_ROLE_RESTRICTED_ERROR_CODE });
    }
  }

  async #assertProjectsInOrganization(organizationId: string, projectGrants: ProjectGrant[]) {
    if (projectGrants.length === 0) return;

    const projectIds = projectGrants.map(grant => grant.projectId);
    const foundIds = await this.projectRepository.findActiveIdsAmong(organizationId, projectIds);
    assert(foundIds.length === projectIds.length, 400, "Project grants must name projects of the active organization");
  }

  async #assertNoneAreMembers(organizationId: string, emails: string[]) {
    const memberEmails = await this.organizationMemberRepository.findEmailsOfMembers(organizationId, emails);

    if (memberEmails.length > 0) {
      throw createError(409, "An address belongs to a member of the organization", { errorCode: ALREADY_MEMBER_ERROR_CODE });
    }
  }

  async #assertRoomForInvitations(organizationId: string, count: number) {
    if (count === 0) return;

    const pendingCount = await this.invitationRepository.countPending(organizationId);

    if (pendingCount + count > MAX_PENDING_INVITATIONS_PER_ORGANIZATION) {
      throw createError(403, "The organization has reached its limit of pending invitations", { errorCode: INVITATION_LIMIT_REACHED_ERROR_CODE });
    }
  }

  #repositoryFor(action: InvitationAction): OrganizationInvitationRepository {
    return this.invitationRepository.accessibleBy(this.authService.ability, action);
  }

  #activeTeamOrganization(): OrganizationContext {
    const context = this.#activeOrganization();

    if (context.organizationType === "personal") {
      throw createError(403, "A personal organization cannot invite members", { errorCode: PERSONAL_ORGANIZATION_ERROR_CODE });
    }

    return context;
  }

  #activeOrganization(): OrganizationContext {
    const context = this.executionContextService.get("ORGANIZATION_CONTEXT");
    assert(context, 403, "No active organization");

    return context;
  }
}

function newExpiry(): Date {
  return addDays(new Date(), INVITATION_VALIDITY_IN_DAYS);
}

function hasExpired(invitation: Pick<OrganizationInvitationOutput, "expiresAt">): boolean {
  return invitation.expiresAt <= new Date();
}

/** The invitation stays unusable until the email job or a link issues a token someone actually holds. */
function unissuedTokenHash(): string {
  return hashInvitationToken(createInvitationToken());
}
