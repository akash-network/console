import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { JobQueueService } from "@src/core";
import { TxService } from "@src/core/services/tx/tx.service";
import type { JoinGpuWaitlistRequest } from "@src/gpu-waitlist/http-schemas/gpu-waitlist.schema";
import { toPoolKey } from "@src/gpu-waitlist/lib/gpu-pool-key/gpu-pool-key";
import { GPU_WAITLIST_CONFIG, type GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import { GpuWaitlistEntryRepository, type GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { AskStillWanted } from "@src/gpu-waitlist/services/still-wanted/ask-still-wanted.job";
import { UserRepository } from "@src/user/repositories";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type JoinWindow = { durationMs: number; limit: number; message: string };

type Refusal = { message: string; retryAfterSeconds: number };

export type GpuWaitlistEntryInLine = GpuWaitlistEntryRow & { placeInLine: number };

/** Waits on the join `limit` places before the newest, since a window a lowered limit left over-full needs more than its oldest to leave. */
function refusalIn({ durationMs, limit, message }: JoinWindow, joinTimes: Date[], now: number): Refusal | undefined {
  const windowStart = now - durationMs;
  const inWindow = joinTimes.filter(joinedAt => joinedAt.getTime() > windowStart);

  if (inWindow.length < limit) return undefined;

  const releasing = inWindow[inWindow.length - limit];
  return { message, retryAfterSeconds: Math.ceil((releasing.getTime() - windowStart) / 1000) };
}

@singleton()
export class GpuWaitlistService {
  constructor(
    private readonly gpuWaitlistEntryRepository: GpuWaitlistEntryRepository,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly txService: TxService,
    private readonly jobQueueService: JobQueueService,
    @inject(GPU_WAITLIST_CONFIG) private readonly config: GpuWaitlistConfig
  ) {}

  async join(input: JoinGpuWaitlistRequest["data"]): Promise<GpuWaitlistEntryInLine> {
    const userId = this.authService.currentUser.id;
    const poolKey = toPoolKey(input);

    return await this.txService.transaction(async () => {
      await this.userRepository.findOneByAndLock({ id: userId }, { strength: "no key update" });

      const existing = await this.gpuWaitlistEntryRepository.accessibleBy(this.authService.ability, "read").findWaitingInPoolOf(poolKey);
      const entry = (existing && (await this.#refreshWhileWaiting(existing, input))) || (await this.#enter(userId, poolKey, input));

      return await this.#withPlaceInLine(entry);
    });
  }

  async list(): Promise<GpuWaitlistEntryInLine[]> {
    const entries = await this.gpuWaitlistEntryRepository.accessibleBy(this.authService.ability, "read").findWaitingNewestFirst();

    return await Promise.all(entries.map(entry => this.#withPlaceInLine(entry)));
  }

  async leave(id: string): Promise<void> {
    const left = await this.gpuWaitlistEntryRepository
      .accessibleBy(this.authService.ability, "update")
      .updateBy({ id, status: "waiting" }, { status: "left", endedAt: new Date() }, { returning: true });

    if (!left) {
      throw createError(404, "GPU waitlist entry not found");
    }
  }

  async keep(id: string): Promise<GpuWaitlistEntryInLine> {
    return await this.txService.transaction(async () => {
      const kept = await this.gpuWaitlistEntryRepository
        .accessibleBy(this.authService.ability, "update")
        .updateBy({ id, status: "waiting" }, { stillWantedAskedAt: null }, { returning: true });

      if (!kept) {
        throw createError(404, "GPU waitlist entry not found");
      }

      await this.#scheduleStillWantedCheck(kept.id, new Date());

      return await this.#withPlaceInLine(kept);
    });
  }

  async #scheduleStillWantedCheck(entryId: string, from: Date): Promise<void> {
    await this.jobQueueService.enqueue(new AskStillWanted({ entryId }), {
      startAfter: new Date(from.getTime() + this.config.GPU_WAITLIST_STILL_WANTED_DAYS * DAY_MS)
    });
  }

  /** Leaving takes no user-row lock, so the entry read as waiting may have been left since. */
  async #refreshWhileWaiting(existing: GpuWaitlistEntryRow, input: JoinGpuWaitlistRequest["data"]): Promise<GpuWaitlistEntryRow | undefined> {
    return await this.gpuWaitlistEntryRepository
      .accessibleBy(this.authService.ability, "update")
      .updateBy({ id: existing.id, status: "waiting" }, { gpuCount: input.gpuCount, source: input.source }, { returning: true });
  }

  async #enter(userId: string, poolKey: string, input: JoinGpuWaitlistRequest["data"]): Promise<GpuWaitlistEntryRow> {
    await this.#assertWithinJoinLimits(userId);

    if ((await this.gpuWaitlistEntryRepository.countWaitingAcrossOrganizations(userId)) >= this.config.GPU_WAITLIST_MAX_ACTIVE_ENTRIES) {
      throw createError(409, `You can wait for up to ${this.config.GPU_WAITLIST_MAX_ACTIVE_ENTRIES} GPU setups at once. Leave one to join another.`, {
        errorCode: "gpu_waitlist_active_limit"
      });
    }

    const entry = await this.gpuWaitlistEntryRepository.accessibleBy(this.authService.ability, "create").create({ ...input, userId, poolKey });
    await this.#scheduleStillWantedCheck(entry.id, entry.joinedAt);

    return entry;
  }

  async #withPlaceInLine(entry: GpuWaitlistEntryRow): Promise<GpuWaitlistEntryInLine> {
    const placeInLine = await this.gpuWaitlistEntryRepository.findPlaceInLineAcrossOrganizations(entry);

    return { ...entry, placeInLine };
  }

  async #assertWithinJoinLimits(userId: string): Promise<void> {
    const now = Date.now();
    const windows: JoinWindow[] = [
      {
        durationMs: DAY_MS,
        limit: this.config.GPU_WAITLIST_JOIN_DAILY_LIMIT,
        message: `You can join up to ${this.config.GPU_WAITLIST_JOIN_DAILY_LIMIT} GPU waitlists a day. Try again later.`
      },
      {
        durationMs: HOUR_MS,
        limit: this.config.GPU_WAITLIST_JOIN_HOURLY_LIMIT,
        message: `You can join up to ${this.config.GPU_WAITLIST_JOIN_HOURLY_LIMIT} GPU waitlists an hour. Try again later.`
      }
    ];
    const joinTimes = await this.gpuWaitlistEntryRepository.findJoinTimesAcrossOrganizationsSince(userId, new Date(now - DAY_MS));

    const refusals = windows.map(window => refusalIn(window, joinTimes, now)).filter(refusal => refusal !== undefined);

    if (refusals.length === 0) return;

    const latest = refusals.reduce((later, refusal) => (refusal.retryAfterSeconds > later.retryAfterSeconds ? refusal : later));
    throw createError(429, latest.message, { errorCode: "gpu_waitlist_join_limit", headers: { "Retry-After": String(latest.retryAfterSeconds) } });
  }
}
