import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { hardwareRequestTitle } from "@src/hardware-request/lib/hardware-request-title/hardware-request-title";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import {
  type HardwareRequestOfferOutput,
  HardwareRequestOfferRepository
} from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { gpuOfferApprovalRequestNotification } from "@src/notifications/services/notification-templates/gpu-offer-approval-request-notification";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { UserRepository } from "@src/user/repositories";

const APPROVING_ROLES: OrganizationRole[] = ["owner", "admin"];

export class HardwareRequestApprovalRequestJob implements Job {
  static readonly [JOB_NAME] = "HardwareRequestApprovalRequestJob";
  readonly name = HardwareRequestApprovalRequestJob[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { hardwareRequestId: string; offerId: string; eventId: string; requestedByUserId: string }) {}
}

@singleton()
export class HardwareRequestApprovalRequestHandler implements JobHandler<HardwareRequestApprovalRequestJob> {
  public readonly accepts = HardwareRequestApprovalRequestJob;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly hardwareRequestOfferRepository: HardwareRequestOfferRepository,
    private readonly userRepository: UserRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly notificationService: NotificationService,
    private readonly deploymentConfigService: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: HardwareRequestApprovalRequestHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ hardwareRequestId, offerId, eventId, requestedByUserId }: JobPayload<HardwareRequestApprovalRequestJob>): Promise<void> {
    const [hardwareRequest, offer, requestedBy] = await Promise.all([
      this.hardwareRequestRepository.findById(hardwareRequestId),
      this.hardwareRequestOfferRepository.findById(offerId),
      this.userRepository.findById(requestedByUserId)
    ]);

    if (!hardwareRequest?.organizationId || !offer || !requestedBy) {
      this.#logger.warn({ event: "HARDWARE_REQUEST_APPROVAL_REQUEST_SKIPPED", hardwareRequestId, offerId, reason: "Request, offer or requester not found" });
      return;
    }

    const members = await this.organizationMemberRepository.findAllWithUsers(hardwareRequest.organizationId);
    const approvers = members.flatMap(({ userId, role, email }) => (email && APPROVING_ROLES.includes(role) ? [{ id: userId, email }] : []));
    const vars = {
      eventId,
      requestedBy: requestedBy.username ?? requestedBy.email ?? "A member",
      requestTitle: hardwareRequestTitle(hardwareRequest),
      offerSummary: summarizeOffer(offer),
      requestUrl: `${this.deploymentConfigService.get("DEPLOY_WEB_BASE_URL")}/gpu-requests/${encodeURIComponent(hardwareRequestId)}`
    };

    for (const approver of approvers) {
      await this.notificationService.createNotification(gpuOfferApprovalRequestNotification(approver, vars));
    }
  }
}

function summarizeOffer({ terms, usdPerGpuHour }: HardwareRequestOfferOutput): string {
  return `${terms.gpu.count}× ${terms.gpu.model} in ${terms.location} at $${usdPerGpuHour}/GPU-hour`;
}
