import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { JobQueueService } from "@src/core";
import { TxService } from "@src/core/services/tx/tx.service";
import { SDL_GPU_ATTRIBUTE_VALUE } from "@src/deployment/services/gpu-bids-creator/gpu-check-sdl";
import type { JoinGpuWaitlistRequest } from "@src/gpu-waitlist/http-schemas/gpu-waitlist.schema";
import { toPoolKey } from "@src/gpu-waitlist/lib/gpu-pool-key/gpu-pool-key";
import { toGpuSetupInterface } from "@src/gpu-waitlist/lib/pool-supply/pool-supply";
import { GPU_WAITLIST_CONFIG, type GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import { GpuWaitlistEntryRepository, type GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { AskStillWanted } from "@src/gpu-waitlist/services/still-wanted/ask-still-wanted.job";
import { UserRepository } from "@src/user/repositories";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const GPU_MEMORY = /^(\d+)\s*(gi|g)$/i;

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

/** A pool's oldest entry supplies the setup its checks deploy, so a setup no check could build would silence the whole pool. */
function normaliseSetup(request: JoinGpuWaitlistRequest["data"]): JoinGpuWaitlistRequest["data"] {
  const model = request.model.trim().toLowerCase();

  if (!SDL_GPU_ATTRIBUTE_VALUE.test(model)) {
    throw createError(400, "GPU model can only hold letters, digits, dots, dashes and underscores", { errorCode: "gpu_waitlist_invalid_model" });
  }

  if (request.interface && !toGpuSetupInterface(request.interface)) {
    throw createError(400, "GPU interface must name the PCIe or SXM family, such as sxm5", { errorCode: "gpu_waitlist_invalid_interface" });
  }

  return { ...request, model, memory: request.memory && normaliseMemory(request.memory), interface: request.interface?.toLowerCase() };
}

function normaliseMemory(memory: string): string {
  const match = GPU_MEMORY.exec(memory);

  if (!match) {
    throw createError(400, "GPU memory must be a size in Gi, such as 80Gi", { errorCode: "gpu_waitlist_invalid_memory" });
  }

  return `${Number(match[1])}Gi`;
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

  async join(request: JoinGpuWaitlistRequest["data"]): Promise<GpuWaitlistEntryInLine> {
    const userId = this.authService.currentUser.id;
    const input = normaliseSetup(request);
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
      const repository = this.gpuWaitlistEntryRepository.accessibleBy(this.authService.ability, "update");
      const kept = (await this.#answerPendingQuestion(repository, id)) ?? (await repository.findWaitingById(id));

      if (!kept) {
        throw createError(404, "GPU waitlist entry not found");
      }

      return await this.#withPlaceInLine(kept);
    });
  }

  async #answerPendingQuestion(repository: GpuWaitlistEntryRepository, id: string): Promise<GpuWaitlistEntryRow | undefined> {
    const cleared = await repository.clearPendingStillWantedQuestion(id);

    if (cleared) {
      await this.#scheduleStillWantedCheck(cleared.id, new Date());
    }

    return cleared;
  }

  async #scheduleStillWantedCheck(entryId: string, from: Date): Promise<void> {
    await this.jobQueueService.enqueue(new AskStillWanted({ entryId }), {
      startAfter: new Date(from.getTime() + this.config.GPU_WAITLIST_STILL_WANTED_DAYS * DAY_MS)
    });
  }

  /** Joining again answers a pending still-wanted question the way keeping does, and finds nothing to refresh once a concurrent leave ended the entry. */
  async #refreshWhileWaiting(existing: GpuWaitlistEntryRow, input: JoinGpuWaitlistRequest["data"]): Promise<GpuWaitlistEntryRow | undefined> {
    const repository = this.gpuWaitlistEntryRepository.accessibleBy(this.authService.ability, "update");
    const refreshed = await repository.updateBy(
      { id: existing.id, status: "waiting" },
      { gpuCount: input.gpuCount, source: input.source },
      { returning: true }
    );

    if (!refreshed) return undefined;

    return (await this.#answerPendingQuestion(repository, existing.id)) ?? refreshed;
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
