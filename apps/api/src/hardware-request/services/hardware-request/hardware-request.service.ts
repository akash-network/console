import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { HardwareRequestInput } from "@src/hardware-request/http-schemas/hardware-request.schema";
import { HARDWARE_REQUEST_CONFIG, type HardwareRequestConfig } from "@src/hardware-request/providers/config.provider";
import { type HardwareRequestOutput, HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestEmailJob } from "@src/hardware-request/services/hardware-request-email/hardware-request-email.handler";
import { UserRepository } from "@src/user/repositories";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type RequestWindow = { durationMs: number; limit: number; message: string };

@singleton()
export class HardwareRequestService {
  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly txService: TxService,
    private readonly jobQueueService: JobQueueService,
    @inject(HARDWARE_REQUEST_CONFIG) private readonly config: HardwareRequestConfig
  ) {}

  async create({ email, ...fields }: HardwareRequestInput): Promise<HardwareRequestOutput> {
    const userId = this.authService.currentUser.id;

    return await this.txService.transaction(async () => {
      await this.userRepository.findOneByAndLock({ id: userId });
      await this.#assertWithinLimits(userId);

      const hardwareRequest = await this.hardwareRequestRepository
        .accessibleBy(this.authService.ability, "create")
        .create({ ...fields, contactEmail: email, userId });
      await this.jobQueueService.enqueue(new HardwareRequestEmailJob({ hardwareRequestId: hardwareRequest.id }));

      return hardwareRequest;
    });
  }

  /** Windows run longest first, so a user over both limits is told the later time they can send again. */
  async #assertWithinLimits(userId: string): Promise<void> {
    const now = Date.now();
    const windows: RequestWindow[] = [
      {
        durationMs: DAY_MS,
        limit: this.config.HARDWARE_REQUEST_DAILY_LIMIT,
        message: `You can send up to ${this.config.HARDWARE_REQUEST_DAILY_LIMIT} requests a day. Try again later, or ask us on Discord.`
      },
      {
        durationMs: HOUR_MS,
        limit: this.config.HARDWARE_REQUEST_HOURLY_LIMIT,
        message: `You can send up to ${this.config.HARDWARE_REQUEST_HOURLY_LIMIT} requests an hour. Try again later, or ask us on Discord.`
      }
    ];
    const creationTimes = await this.hardwareRequestRepository.findCreationTimesSince(userId, new Date(now - DAY_MS));

    for (const { durationMs, limit, message } of windows) {
      const windowStart = now - durationMs;
      const inWindow = creationTimes.filter(createdAt => createdAt.getTime() > windowStart);

      if (inWindow.length >= limit) {
        const retryAfterSeconds = Math.ceil((inWindow[0].getTime() - windowStart) / 1000);
        throw createError(429, message, { errorCode: "hardware_request_limit", headers: { "Retry-After": String(retryAfterSeconds) } });
      }
    }
  }
}
