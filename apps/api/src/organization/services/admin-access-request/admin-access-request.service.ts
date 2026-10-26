import assert from "http-assert";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { JobQueueService } from "@src/core";
import { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import {
  AdminAccessRequestEmailJob,
  ROLES_THAT_MANAGE_MEMBERS
} from "@src/organization/services/admin-access-request-email/admin-access-request-email.handler";
import { PERSONAL_ORGANIZATION_ERROR_CODE } from "@src/organization/services/organization-member/organization-member.service";

export const ALREADY_ADMIN_ERROR_CODE = "already_admin";
export const ADMIN_ACCESS_REQUEST_LIMIT_ERROR_CODE = "admin_access_request_limit_reached";

/** pg-boss throttles on fixed slots counted from the epoch, so a member can ask again once the UTC day turns over. */
export const ADMIN_ACCESS_REQUEST_WINDOW_SECONDS = 24 * 60 * 60;

@singleton()
export class AdminAccessRequestService {
  constructor(
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService
  ) {}

  /** Emails every owner of the active team that the caller wants to be an admin, at most once a day per owner. */
  async request(organizationId: string): Promise<void> {
    const context = this.executionContextService.get("ORGANIZATION_CONTEXT");
    assert(context, 403, "No active organization");
    assert(context.organizationId === organizationId, 404, "Organization not found");

    if (context.organizationType === "personal") {
      throw createError(403, "A personal organization has no one to ask for admin access", { errorCode: PERSONAL_ORGANIZATION_ERROR_CODE });
    }

    if (ROLES_THAT_MANAGE_MEMBERS.includes(context.role)) {
      throw createError(409, "You already manage this organization", { errorCode: ALREADY_ADMIN_ERROR_CODE });
    }

    const jobIds = await this.#emailOwners(organizationId, this.authService.currentUser.id);

    if (jobIds.every(jobId => jobId === null)) {
      throw createError(429, "You already asked for admin access today. Try again tomorrow.", {
        errorCode: ADMIN_ACCESS_REQUEST_LIMIT_ERROR_CODE,
        headers: { "Retry-After": String(secondsUntilNextWindow()) }
      });
    }
  }

  /** An owner already emailed in the current window yields a null job id, since pg-boss drops a throttled send. */
  async #emailOwners(organizationId: string, requesterUserId: string): Promise<(string | null)[]> {
    const owners = await this.organizationMemberRepository.find({ organizationId, role: "owner" });
    const requestedAt = new Date().toISOString();

    return await this.txService.transaction(async () => {
      const jobIds: (string | null)[] = [];

      for (const { userId: ownerUserId } of owners) {
        jobIds.push(
          await this.jobQueueService.enqueue(new AdminAccessRequestEmailJob({ organizationId, requesterUserId, ownerUserId, requestedAt }), {
            singletonKey: `${organizationId}.${requesterUserId}.${ownerUserId}`,
            singletonSeconds: ADMIN_ACCESS_REQUEST_WINDOW_SECONDS
          })
        );
      }

      return jobIds;
    });
  }
}

function secondsUntilNextWindow(): number {
  const nowInSeconds = Math.floor(Date.now() / 1000);

  return ADMIN_ACCESS_REQUEST_WINDOW_SECONDS - (nowInSeconds % ADMIN_ACCESS_REQUEST_WINDOW_SECONDS);
}
