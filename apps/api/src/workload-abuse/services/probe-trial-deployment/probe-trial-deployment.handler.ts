import { inject, singleton } from "tsyringe";

import { isWalletInitialized, UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { findBehaviouralAgreement } from "@src/workload-abuse/lib/behavioural-signals/agreement";
import { withoutFileContents } from "@src/workload-abuse/lib/evidence-scanner/evidence-scanner";
import { truncateToUtf8Bytes } from "@src/workload-abuse/lib/utf8-text/utf8-text";
import { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import { WorkloadProbeEvidenceRepository } from "@src/workload-abuse/repositories/workload-probe-evidence/workload-probe-evidence.repository";
import { EnforceTrialAbuse, enforceTrialAbuseKeyFor } from "@src/workload-abuse/services/enforce-trial-abuse/enforce-trial-abuse.handler";
import { ProbeEvidenceService } from "@src/workload-abuse/services/probe-evidence/probe-evidence.service";
import { type ProbeReport, TrialWorkloadProbeService } from "@src/workload-abuse/services/trial-workload-probe/trial-workload-probe.service";
import { ProbeTrialDeployment, TrialWorkloadProbeJobService } from "@src/workload-abuse/services/trial-workload-probe-job/trial-workload-probe-job.service";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";

/** Loki splits a line past 16 KiB into unparseable partials, and a clean verdict has nowhere else to keep what the shell saw. */
const MAX_LOGGED_EXCERPT_BYTES = 4_096;

/** Re-reads the wallet and the chain on every run, so a probe that waited an hour decides on what is true when it runs, not when it was queued. */
@singleton()
export class ProbeTrialDeploymentHandler implements JobHandler<ProbeTrialDeployment> {
  public readonly accepts = ProbeTrialDeployment;

  public readonly concurrency = 2;

  /** One job per state per deployment: the self re-enqueue is accepted while this run is active, and a concurrent sweep enqueue for the same key is dropped. */
  public readonly policy = "stately";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly probeService: TrialWorkloadProbeService,
    private readonly probeJobService: TrialWorkloadProbeJobService,
    private readonly detectionRepository: WorkloadAbuseDetectionRepository,
    private readonly evidenceRepository: WorkloadProbeEvidenceRepository,
    private readonly probeEvidenceService: ProbeEvidenceService,
    private readonly instrumentation: WorkloadAbuseInstrumentationService,
    private readonly config: WorkloadAbuseConfigService,
    private readonly jobQueueService: JobQueueService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ProbeTrialDeploymentHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: JobPayload<ProbeTrialDeployment>): Promise<void> {
    const { walletId, dseq, attempt } = payload;
    const context = { job: ProbeTrialDeployment[JOB_NAME], walletId, dseq, attempt };

    if (!this.config.get("WORKLOAD_ABUSE_PROBE_ENABLED")) {
      this.logger.debug({ event: "TRIAL_WORKLOAD_PROBE_SKIPPED", reason: "PROBING_DISABLED", ...context });
      return;
    }

    const wallet = await this.userWalletRepository.findById(walletId);

    if (!wallet || !isWalletInitialized(wallet)) {
      this.logger.warn({ event: "TRIAL_WORKLOAD_PROBE_SKIPPED", reason: "WALLET_NOT_FOUND", ...context });
      return;
    }

    if (!wallet.isTrialing) {
      this.logger.debug({ event: "TRIAL_WORKLOAD_PROBE_SKIPPED", reason: "NOT_TRIALING", ...context, userId: wallet.userId });
      return;
    }

    if (wallet.abuseLockedAt) {
      this.logger.debug({ event: "TRIAL_WORKLOAD_PROBE_SKIPPED", reason: "ABUSE_LOCKED", ...context, userId: wallet.userId });
      return;
    }

    const existingDetection = await this.detectionRepository.findOneBy({ walletId, dseq, verdict: "hard" });

    if (existingDetection) {
      this.logger.info({
        event: "TRIAL_WORKLOAD_PROBE_FINISHED",
        reason: "ALREADY_DETECTED",
        ...context,
        userId: wallet.userId,
        detectionId: existingDetection.id
      });
      await this.#enforce(wallet, existingDetection.id, context);
      return;
    }

    const report = await this.probeService.probe({ wallet, dseq });
    this.instrumentation.recordProbe(report);

    if (report.probeStatus === "no_live_lease") {
      this.logger.info({ event: "TRIAL_WORKLOAD_PROBE_FINISHED", reason: "NO_LIVE_LEASE", ...context, userId: wallet.userId });
      return;
    }

    const detectionId = report.verdict === "clean" ? undefined : await this.#recordDetection(wallet, dseq, report);

    const evidenceRows = await this.probeEvidenceService.recordEvidence({
      walletId: wallet.id,
      dseq,
      verdict: report.verdict,
      detectionId,
      shellEvidence: report.shellEvidence
    });
    if (evidenceRows.length) {
      this.logger.info({
        event: "TRIAL_WORKLOAD_EVIDENCE_RECORDED",
        ...context,
        userId: wallet.userId,
        services: evidenceRows.map(row => row.service)
      });
    }

    const recordedFindings = await this.probeEvidenceService.recordBehaviouralFindings(evidenceRows);

    for (const recorded of recordedFindings) {
      this.logger.info({
        event: "TRIAL_WORKLOAD_BEHAVIOURAL_FINDING",
        ...context,
        userId: wallet.userId,
        service: recorded.service,
        evidenceId: recorded.evidenceId,
        signals: recorded.findings.map(finding => finding.signal)
      });
    }

    this.logger.info({
      event: "TRIAL_WORKLOAD_PROBED",
      ...context,
      userId: wallet.userId,
      verdict: report.verdict,
      probeStatus: report.probeStatus,
      evidence: truncateToUtf8Bytes(withoutFileContents(report.excerpt), MAX_LOGGED_EXCERPT_BYTES),
      leases: report.leases.map(lease => ({
        provider: lease.provider,
        services: lease.services,
        shellStatuses: lease.shellStatuses,
        logStatus: lease.logStatus
      }))
    });

    if (report.verdict === "hard") {
      if (detectionId) await this.#enforce(wallet, detectionId, context);
      return;
    }

    if (await this.#enforceOnRepeatedShape(wallet, dseq, report, context)) return;

    if (attempt >= this.config.get("WORKLOAD_ABUSE_PROBE_MAX_PER_DEPLOYMENT")) {
      this.logger.info({ event: "TRIAL_WORKLOAD_PROBE_FINISHED", reason: "MAX_ATTEMPTS", ...context, userId: wallet.userId });
      return;
    }

    await this.probeJobService.scheduleNext(payload);
  }

  async #recordDetection(wallet: { id: number; userId: string; address: string }, dseq: string, report: ProbeReport): Promise<string> {
    const detection = await this.detectionRepository.create({
      userId: wallet.userId,
      walletId: wallet.id,
      dseq,
      provider: report.leases.map(lease => lease.provider).join(","),
      verdict: report.verdict as "hard" | "soft" | "proxy",
      probeStatus: report.probeStatus,
      signals: report.signals,
      evidenceExcerpt: withoutFileContents(report.excerpt)
    });
    this.instrumentation.recordDetection(report.verdict);

    this.logger.warn({
      event: report.verdict === "hard" ? "TRIAL_WORKLOAD_ABUSE_DETECTED" : "TRIAL_WORKLOAD_SUSPICIOUS",
      detectionId: detection.id,
      userId: wallet.userId,
      walletId: wallet.id,
      owner: wallet.address,
      dseq,
      verdict: report.verdict,
      signals: report.signals.map(signal => ({ bucket: signal.bucket, category: signal.category, source: signal.source, service: signal.service }))
    });

    return detection.id;
  }

  /** One probe cannot tell a shape apart from a moment, so the same shape has to hold across probes and across time before it counts. */
  async #enforceOnRepeatedShape(
    wallet: { id: number; userId: string; address: string },
    dseq: string,
    report: ProbeReport,
    context: Record<string, unknown>
  ): Promise<boolean> {
    if (!this.config.get("WORKLOAD_ABUSE_BEHAVIOURAL_ENFORCEMENT_ENABLED")) return false;

    const rows = await this.evidenceRepository.findRecentForDeployment({ walletId: wallet.id, dseq, since: this.#evidenceLookbackStart() });
    const agreement = findBehaviouralAgreement(rows, {
      agreementProbes: this.config.get("WORKLOAD_ABUSE_BEHAVIOURAL_AGREEMENT_PROBES"),
      minWindowMinutes: this.config.get("WORKLOAD_ABUSE_BEHAVIOURAL_MIN_WINDOW_MINUTES")
    });

    if (!agreement.agreed) return false;

    const existing = await this.detectionRepository.findOneBy({ walletId: wallet.id, dseq, verdict: "behavioural" });

    if (existing) {
      await this.#enforce(wallet, existing.id, context);
      return true;
    }

    const detection = await this.detectionRepository.create({
      userId: wallet.userId,
      walletId: wallet.id,
      dseq,
      provider: report.leases.map(lease => lease.provider).join(","),
      verdict: "behavioural",
      probeStatus: report.probeStatus,
      signals: report.signals,
      evidenceExcerpt: withoutFileContents(report.excerpt)
    });
    this.instrumentation.recordDetection("behavioural");

    this.logger.warn({
      event: "TRIAL_WORKLOAD_SHAPE_CONFIRMED",
      ...context,
      userId: wallet.userId,
      detectionId: detection.id,
      service: agreement.service,
      probes: agreement.streak,
      spanMinutes: agreement.spanMinutes
    });

    await this.#enforce(wallet, detection.id, context);

    return true;
  }

  /** Reading back less far than the window agreement has to span would put agreement out of reach whatever the workload does. */
  #evidenceLookbackStart(): Date {
    const probeSpanMinutes = this.config.get("WORKLOAD_ABUSE_PROBE_INTERVAL_MIN") * this.config.get("WORKLOAD_ABUSE_PROBE_MAX_PER_DEPLOYMENT");
    const lookbackMinutes = Math.max(probeSpanMinutes, this.config.get("WORKLOAD_ABUSE_BEHAVIOURAL_MIN_WINDOW_MINUTES"));

    return new Date(Date.now() - lookbackMinutes * 60_000);
  }

  /** Detect mode records the verdict and stops there, so a rollout can be compared against manual review before anything is wiped. */
  async #enforce(wallet: { id: number; userId: string }, detectionId: string, context: Record<string, unknown>): Promise<void> {
    if (this.config.get("WORKLOAD_ABUSE_ENFORCEMENT_MODE") !== "enforce") {
      this.logger.info({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_DEFERRED", reason: "DETECT_MODE", ...context, userId: wallet.userId, detectionId });
      return;
    }

    await this.jobQueueService.enqueue(new EnforceTrialAbuse({ walletId: wallet.id, detectionId }), { singletonKey: enforceTrialAbuseKeyFor(wallet.id) });
  }
}
