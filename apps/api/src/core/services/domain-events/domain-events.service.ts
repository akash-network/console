import { singleton } from "tsyringe";

import { LoggerService } from "../../providers/logging.provider";
import { EnqueueOptions, Job, JOB_NAME, JobPayload, JobQueueService } from "../job-queue/job-queue.service";
import { TimerService } from "../timer/timer.service";

export { JOB_NAME as DOMAIN_EVENT_NAME };
export interface DomainEvent extends Job {}

export type EventPayload<T extends DomainEvent> = JobPayload<T>;

/** Outcome of a `publishAndAwait` call. `cancelled` / `expired` pg-boss states are normalized to `"failed"`. */
export type JobOutcome =
  | { status: "completed"; jobId: string; output?: unknown }
  | { status: "failed"; jobId: string; output?: unknown }
  | { status: "timeout"; jobId: string };

/** Default polling interval (ms) used when no `pollIntervalMs` is supplied to `publishAndAwait`. */
const DEFAULT_POLL_INTERVAL_MS = 250;

/** Default timeout (ms) used when no `timeoutMs` is supplied to `publishAndAwait`. */
const DEFAULT_TIMEOUT_MS = 30_000;

@singleton()
export class DomainEventsService {
  constructor(
    private readonly jobQueueManager: JobQueueService,
    private readonly logger: LoggerService,
    private readonly timer: TimerService
  ) {}

  async publish(event: DomainEvent, options?: EnqueueOptions): Promise<string | null> {
    try {
      return await this.jobQueueManager.enqueue(event, options);
    } catch (error) {
      this.logger.error({
        event: "DOMAIN_EVENT_PUBLISH_FAILED",
        domainEvent: event,
        error
      });

      return null;
    }
  }

  /**
   * Publishes a domain event and polls pg-boss for the job's terminal state.
   *
   * Reuses `publish` so error logging stays identical. If `publish` returns `null` (enqueue failed),
   * the returned outcome is `{ status: "failed", jobId: "" }` — callers can distinguish this from a
   * normal failure by the empty `jobId`.
   *
   * On timeout, the job is **not** cancelled — it stays in pg-boss and continues running.
   *
   * pg-boss `state` mapping:
   * - `completed` → `"completed"`
   * - `failed` / `cancelled` / `expired` → `"failed"` (pg-boss v12 types omit `expired`, but the
   *   runtime is handled defensively in case future versions surface it)
   * - `created` / `retry` / `active` → keep polling
   *
   * @param event - The domain event to publish.
   * @param options.timeoutMs - Max ms to wait for a terminal state. Defaults to 30s.
   * @param options.pollIntervalMs - Polling interval in ms. Defaults to 250ms.
   */
  async publishAndAwait<T extends DomainEvent>(event: T, options: { timeoutMs?: number; pollIntervalMs?: number } = {}): Promise<JobOutcome> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

    const jobId = await this.publish(event);
    if (!jobId) {
      return { status: "failed", jobId: "" };
    }

    const start = Date.now();
    for (;;) {
      const snapshot = await this.jobQueueManager.getJobState(event.name, jobId);
      const terminal = snapshot ? mapTerminalState(snapshot.state) : null;
      if (terminal) {
        return { status: terminal, jobId, output: snapshot?.output };
      }

      if (Date.now() - start >= timeoutMs) {
        this.logger.warn({
          event: "JOB_AWAIT_TIMEOUT",
          jobId,
          name: event.name,
          timeoutMs
        });
        return { status: "timeout", jobId };
      }

      await this.timer.delay(pollIntervalMs);
    }
  }
}

/**
 * Map a pg-boss job state to a terminal `JobOutcome.status` or `null` if the job is still pending.
 *
 * `cancelled` and `expired` are normalized to `"failed"` from the caller's perspective —
 * the work didn't complete successfully.
 */
function mapTerminalState(state: string): "completed" | "failed" | null {
  if (state === "completed") return "completed";
  if (state === "failed" || state === "cancelled" || state === "expired") return "failed";
  return null;
}
