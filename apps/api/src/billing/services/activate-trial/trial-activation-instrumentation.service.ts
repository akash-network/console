import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { Counter, Histogram, Meter } from "@opentelemetry/api";
import { isHttpError } from "http-errors";
import { singleton } from "tsyringe";

import { MetricsService } from "@src/core";
import type { UserOutput } from "@src/user/repositories";

/**
 * Classifies a failed activation so a terminal block (duplicate fingerprint, unverified email) is
 * distinguishable on the dashboard from a transient chain/queue error that the job will retry. Terminal
 * reasons are the ones that need a human — a persistently-blocked wallet 409s forever otherwise.
 */
function classifyFailure(error: unknown): string {
  if (isHttpError(error)) {
    if (error.status === 409) return "provisioning_in_progress";
    if (error.status === 404) return "user_or_wallet_not_found";
    if (error.status === 400 && /email not verified/i.test(error.message)) return "email_not_verified";
    if (error.status === 400 && /unable to start trial/i.test(error.message)) return "fingerprint_block";
  }
  return "grant_failed";
}

@singleton()
export class TrialActivationInstrumentationService {
  private readonly meter: Meter;
  private readonly jobCompletions: Counter;
  private readonly jobDuration: Histogram;
  private readonly activationLatency: Histogram;

  private readonly logger = createOtelLogger({ context: "TrialActivation" });

  constructor(private readonly metricsService: MetricsService) {
    this.meter = this.metricsService.getMeter("trial-activation", "1.0.0");

    this.jobCompletions = this.metricsService.createCounter(this.meter, "trial_activation_job_completions_total", {
      description: "Trial activation job completions, tagged by status and (on failure) reason"
    });

    this.jobDuration = this.metricsService.createHistogram(this.meter, "trial_activation_job_duration_ms", {
      description: "Duration of the trial activation job in milliseconds",
      unit: "ms"
    });

    this.activationLatency = this.metricsService.createHistogram(this.meter, "trial_activation_latency_ms", {
      description: "Wall-clock from wallet creation (registration) to activation. Leading indicator vs the client retry budget.",
      unit: "ms"
    });
  }

  recordJobSucceeded(userId: UserOutput["id"], durationMs: number): void {
    this.jobCompletions.add(1, { status: "success" });
    this.jobDuration.record(durationMs, { status: "success" });
  }

  recordJobFailed(userId: UserOutput["id"], durationMs: number, error: unknown): void {
    const reason = classifyFailure(error);
    this.jobCompletions.add(1, { status: "failure", reason });
    this.jobDuration.record(durationMs, { status: "failure" });
    this.logger.error({ event: "TRIAL_ACTIVATION_JOB_FAILED", userId, reason, error });
  }

  /** Recorded once, at the moment a wallet is newly activated, so the latency histogram isn't double-counted on idempotent re-runs. */
  recordActivated(userId: UserOutput["id"], latencyMs: number): void {
    this.activationLatency.record(latencyMs);
    this.logger.info({ event: "TRIAL_ACTIVATED", userId, latencyMs });
  }
}
