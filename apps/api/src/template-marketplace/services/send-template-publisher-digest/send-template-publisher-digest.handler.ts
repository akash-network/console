import { inject, singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { CreateNotificationInput } from "@src/notifications/services/notification/notification.service";
import { templateMilestoneNotification } from "@src/notifications/services/notification-templates/template-milestone-notification";
import { templatePublisherDigestNotification } from "@src/notifications/services/notification-templates/template-publisher-digest-notification";
import {
  type PromotionalNotificationOutcome,
  PromotionalNotificationService
} from "@src/notifications/services/promotional-notification/promotional-notification.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import {
  crossedMilestone,
  type DigestEntry,
  digestEntryOf,
  digestWeekEndingBefore,
  nextDigestRunAt
} from "@src/template-marketplace/lib/publisher-digest/publisher-digest";
import { type InsightWindow, insightWindowOf } from "@src/template-marketplace/lib/template-insights/template-insights";
import {
  type ActivePublicTemplate,
  TemplateUsageEventRepository
} from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import { TemplateInsightsService } from "@src/template-marketplace/services/template-insights/template-insights.service";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { SendTemplatePublisherDigest, sendTemplatePublisherDigestKeyFor } from "./send-template-publisher-digest.job";

type Milestone = { template: ActivePublicTemplate; milestone: number };

type OrganizationNews = { entries: DigestEntry[]; milestones: Milestone[] };

type Notice = { dedupeKey: string; notification: CreateNotificationInput; templateId?: string };

type DeliveryOutcome = PromotionalNotificationOutcome | "already_told" | "email_failed";

const DIGEST_RECIPIENT_ROLES: OrganizationRole[] = ["owner", "admin"];

const MAX_TEMPLATES_PER_DIGEST = 5000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sends through the product-updates path, so a member who unsubscribed still finds the news in the app but gets no email. */
@singleton()
export class SendTemplatePublisherDigestHandler implements JobHandler<SendTemplatePublisherDigest> {
  public readonly accepts = SendTemplatePublisherDigest;

  /** With the singletonKey of each week, keeps every replica's seed from queueing a second digest. */
  public readonly policy = "exclusive";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly templateUsageEventRepository: TemplateUsageEventRepository,
    private readonly templateInsightsService: TemplateInsightsService,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly userRepository: UserRepository,
    private readonly activityService: ActivityService,
    private readonly promotionalNotificationService: PromotionalNotificationService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly deploymentConfigService: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: SendTemplatePublisherDigestHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async scheduleNextRun(now: Date): Promise<void> {
    const runAt = nextDigestRunAt(now);
    const weekEndsOn = digestWeekEndingBefore(runAt);

    await this.jobQueueService.enqueue(new SendTemplatePublisherDigest({ weekEndsOn }), {
      singletonKey: sendTemplatePublisherDigestKeyFor(weekEndsOn),
      startAfter: runAt.toISOString()
    });
  }

  /** Every replica seeds on boot, so a failure here waits for the next boot rather than keeping the workers down. */
  async seedNextRun(now: Date): Promise<void> {
    try {
      await this.scheduleNextRun(now);
    } catch (error) {
      this.logger.error({ event: "TEMPLATE_PUBLISHER_DIGEST_SCHEDULE_FAILED", error });
    }
  }

  /** The next week is queued before this one is told, and each notice is written to the app before its email, so a retry repeats neither. */
  async handle({ weekEndsOn }: JobPayload<SendTemplatePublisherDigest>): Promise<void> {
    await this.scheduleNextRun(new Date());

    const window = insightWindowOf(new Date(`${weekEndsOn}T00:00:00Z`), 7);
    const news = await this.#gatherNews(window);
    const outcomes: DeliveryOutcome[] = [];

    for (const [organizationId, organizationNews] of news) {
      outcomes.push(...(await this.#tell(organizationId, organizationNews, weekEndsOn)));
    }

    this.logger.info({ event: "TEMPLATE_PUBLISHER_DIGEST_SENT", weekEndsOn, organizations: news.size, outcomes: countsOf(outcomes) });
  }

  async #gatherNews(window: InsightWindow): Promise<Map<string, OrganizationNews>> {
    const templates = await this.templateUsageEventRepository.findPublicTemplatesActiveSince(window.from, MAX_TEMPLATES_PER_DIGEST);
    const news = new Map<string, OrganizationNews>();
    const newsOf = (organizationId: string) => {
      const known = news.get(organizationId);
      if (known) return known;

      const fresh: OrganizationNews = { entries: [], milestones: [] };
      news.set(organizationId, fresh);
      return fresh;
    };

    for (const template of templates) {
      const entry = digestEntryOf(template, await this.templateInsightsService.countInsights(template.id, window));
      const milestone = await this.#milestoneCrossedIn(template.id, window);

      if (entry) newsOf(template.organizationId).entries.push(entry);
      if (milestone) newsOf(template.organizationId).milestones.push({ template, milestone });
    }

    return news;
  }

  async #milestoneCrossedIn(templateId: string, window: InsightWindow): Promise<number | undefined> {
    const dayAfterWindow = new Date(Date.parse(`${window.to}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);
    const [before, after] = await Promise.all([
      this.templateUsageEventRepository.countDeploysBefore(templateId, window.from),
      this.templateUsageEventRepository.countDeploysBefore(templateId, dayAfterWindow)
    ]);

    return crossedMilestone(before, after);
  }

  async #tell(organizationId: string, { entries, milestones }: OrganizationNews, weekEndsOn: string): Promise<DeliveryOutcome[]> {
    const outcomes: DeliveryOutcome[] = [];

    for (const user of await this.#recipientsIn(organizationId)) {
      const notices: Notice[] = milestones.map(({ template, milestone }) => ({
        dedupeKey: `templateMilestone:${template.id}:${milestone}`,
        templateId: template.id,
        notification: templateMilestoneNotification(user, {
          templateId: template.id,
          templateTitle: template.title,
          milestone,
          templateUrl: this.#templateUrlOf(template.id)
        })
      }));

      if (entries.length > 0) {
        notices.unshift({
          dedupeKey: `templateDigest:${organizationId}:${weekEndsOn}`,
          notification: templatePublisherDigestNotification(user, { organizationId, weekEndsOn, entries, templateUrlOf: id => this.#templateUrlOf(id) })
        });
      }

      for (const notice of notices) {
        outcomes.push(await this.#deliver(user, organizationId, notice));
      }
    }

    return outcomes;
  }

  /** Only owners and admins, and only those the marketplace is turned on for. */
  async #recipientsIn(organizationId: string): Promise<UserOutput[]> {
    const members = await this.organizationMemberRepository.unscoped("template-publisher-notifications").findAllWithUsers(organizationId);
    const recipients: UserOutput[] = [];

    for (const member of members) {
      if (!DIGEST_RECIPIENT_ROLES.includes(member.role)) continue;
      if (!this.featureFlagsService.isEnabledForSubject(FeatureFlags.TEMPLATE_MARKETPLACE, member.userId)) continue;

      const user = await this.userRepository.findById(member.userId);
      if (user) recipients.push(user);
    }

    return recipients;
  }

  /** One failed email costs that member the email alone: the job does not retry, since the app already shows the news. */
  async #deliver(user: UserOutput, organizationId: string, { dedupeKey, notification, templateId }: Notice): Promise<DeliveryOutcome> {
    if (await this.activityService.findByDedupeKey(user.id, dedupeKey)) return "already_told";

    await this.activityService.record({
      userId: user.id,
      organizationId,
      type: "template_update",
      status: "info",
      initiator: "system",
      meta: { summary: notification.payload.summary, ...(templateId && { templateId }) },
      dedupeKey
    });

    try {
      return await this.promotionalNotificationService.send(user, notification);
    } catch (error) {
      this.logger.error({ event: "TEMPLATE_PUBLISHER_DIGEST_EMAIL_FAILED", userId: user.id, notificationId: notification.notificationId, error });
      return "email_failed";
    }
  }

  #templateUrlOf(templateId: string): string {
    return `${this.deploymentConfigService.get("DEPLOY_WEB_BASE_URL")}/template/${templateId}`;
  }
}

function countsOf(outcomes: DeliveryOutcome[]): Partial<Record<DeliveryOutcome, number>> {
  const counts: Partial<Record<DeliveryOutcome, number>> = {};

  for (const outcome of outcomes) {
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  }

  return counts;
}
