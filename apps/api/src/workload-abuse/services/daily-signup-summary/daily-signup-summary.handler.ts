import type { HttpClient } from "@akashnetwork/http-sdk";
import { addDays, max, subDays } from "date-fns";
import { inject, singleton } from "tsyringe";

import { SLACK_WEBHOOK_HTTP_CLIENT } from "@src/billing/providers/slack-webhook-client.provider";
import { UserWalletRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type CreateLogger, type EnqueueOptions, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { UserRepository } from "@src/user/repositories";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { buildDailySignupSummaryMessage, type DailySignupSummary } from "./daily-signup-summary-message";

export class PostDailySignupSummary implements Job {
  static readonly [JOB_NAME] = "PostDailySignupSummary";
  readonly name = PostDailySignupSummary[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      windowEndsAt: string;
    }
  ) {}
}

export function dailySignupSummaryKeyFor(windowEndsAt: Date): string {
  return `dailySignupSummary.${windowEndsAt.toISOString().slice(0, 10)}`;
}

export function nextDailySignupSummaryAt(now: Date, hourUtc: number): Date {
  const todayAtHour = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc));
  return todayAtHour > now ? todayAtHour : addDays(todayAtHour, 1);
}

@singleton()
export class DailySignupSummaryHandler implements JobHandler<PostDailySignupSummary> {
  public readonly accepts = PostDailySignupSummary;

  /** One queued, retrying or running summary per day, however many replicas seed it. */
  public readonly policy = "exclusive";

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly userRepository: UserRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly workloadAbuseConfig: WorkloadAbuseConfigService,
    private readonly billingConfig: BillingConfigService,
    @inject(SLACK_WEBHOOK_HTTP_CLIENT) private readonly slackWebhookClient: HttpClient,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: DailySignupSummaryHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async scheduleNextRun(now: Date): Promise<void> {
    const windowEndsAt = nextDailySignupSummaryAt(now, this.workloadAbuseConfig.get("WORKLOAD_ABUSE_DAILY_SUMMARY_HOUR_UTC"));
    const options: EnqueueOptions = { singletonKey: dailySignupSummaryKeyFor(windowEndsAt), startAfter: windowEndsAt.toISOString() };

    await this.jobQueueService.enqueue(new PostDailySignupSummary({ windowEndsAt: windowEndsAt.toISOString() }), options);
  }

  /** Every replica seeds on boot, so a failure here waits for the next boot rather than keeping the workers down. */
  async seedNextRun(now: Date): Promise<void> {
    try {
      await this.scheduleNextRun(now);
    } catch (error) {
      this.#logger.error({ event: "DAILY_SIGNUP_SUMMARY_SCHEDULE_FAILED", error });
    }
  }

  async handle(payload: JobPayload<PostDailySignupSummary>): Promise<void> {
    const windowEndsAt = new Date(payload.windowEndsAt);
    await this.scheduleNextRun(max([windowEndsAt, new Date()]));

    const webhookUrl = this.workloadAbuseConfig.get("WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL");
    if (!webhookUrl || (await this.#wasAlreadyPosted(windowEndsAt))) return;

    const summary = await this.#summarize(subDays(windowEndsAt, 1), windowEndsAt);
    const message = buildDailySignupSummaryMessage(summary, this.billingConfig.get("CONSOLE_ADMIN_URL"));

    try {
      await this.slackWebhookClient.post(webhookUrl, message);
    } catch (error) {
      this.#logger.error({ event: "DAILY_SIGNUP_SUMMARY_POST_FAILED", windowEndsAt: payload.windowEndsAt, error });
      throw error;
    }

    this.#logger.info({ event: "DAILY_SIGNUP_SUMMARY_POSTED", windowEndsAt: payload.windowEndsAt, accounts: summary.accounts.length });
  }

  /** The queue policy only covers unfinished jobs, so a reseed after the day's summary completed would otherwise post it again. */
  async #wasAlreadyPosted(windowEndsAt: Date): Promise<boolean> {
    const finishedKeys = await this.jobQueueService.findRecentlyFinishedSingletonKeys({
      name: PostDailySignupSummary[JOB_NAME],
      since: subDays(windowEndsAt, 1)
    });
    return finishedKeys.has(dailySignupSummaryKeyFor(windowEndsAt));
  }

  async #summarize(windowStartsAt: Date, windowEndsAt: Date): Promise<DailySignupSummary> {
    const [accounts, trialsStarted] = await Promise.all([
      this.userRepository.findCreatedBetween(windowStartsAt, windowEndsAt),
      this.userWalletRepository.countTrialsStartedBetween(windowStartsAt, windowEndsAt)
    ]);

    return { windowStartsAt, windowEndsAt, accounts, trialsStarted };
  }
}
