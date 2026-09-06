import { LeaseHttpService, LIVE_LEASE_STATES, type RpcLease } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import type { WalletInitialized } from "@src/billing/repositories";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import type { ProviderAuth } from "@src/provider/services/provider/provider-proxy.service";
import {
  type DetectionSignal,
  type EvidenceSource,
  scanForSignals,
  toVerdict,
  type WorkloadVerdict
} from "@src/workload-abuse/lib/evidence-scanner/evidence-scanner";
import { ProviderLogTailService } from "@src/workload-abuse/services/provider-log-tail/provider-log-tail.service";
import { ProviderShellProbeService, type ShellProbeStatus } from "@src/workload-abuse/services/provider-shell-probe/provider-shell-probe.service";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

export type ProbeStatus = "probed" | "no_live_lease" | "provider_unknown" | "status_unavailable" | "no_running_service" | "shell_unavailable" | "stream_failed";

export type ProbedLease = {
  provider: string;
  hostUri: string;
  gseq: number;
  oseq: number;
  services: string[];
  shellStatuses: ShellProbeStatus[];
  logStatus?: string;
};

export type ProbeReport = {
  verdict: WorkloadVerdict;
  signals: DetectionSignal[];
  excerpt: string;
  probeStatus: ProbeStatus;
  leases: ProbedLease[];
};

const PROVIDER_SCOPES = ["status", "logs", "shell"] as const;
/** The probed provider reports its own service list, so a hostile one must not be able to stretch a run past this many shell sessions. */
const MAX_PROBED_SERVICES_PER_LEASE = 8;
/** Bounds the audit row; the full shell output stays in the job log, which has its own line cap. */
const MAX_EXCERPT_LENGTH = 8_192;

/** Probes one trial deployment: what its stored SDL declares, what the container is running, and what it logs. */
@singleton()
export class TrialWorkloadProbeService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly leaseHttpService: LeaseHttpService,
    private readonly providerRepository: ProviderRepository,
    private readonly providerService: ProviderService,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly shellProbeService: ProviderShellProbeService,
    private readonly logTailService: ProviderLogTailService,
    private readonly config: WorkloadAbuseConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: TrialWorkloadProbeService.name });
  }

  async probe(input: { wallet: WalletInitialized; dseq: string }): Promise<ProbeReport> {
    const leases = await this.#findLiveLeases(input.wallet.address, input.dseq);

    if (leases.length === 0) {
      return { verdict: "clean", signals: [], excerpt: "", probeStatus: "no_live_lease", leases: [] };
    }

    const sources: EvidenceSource[] = [];
    const setting = await this.deploymentSettingRepository.findOneBy({ userId: input.wallet.userId, dseq: input.dseq });
    if (setting?.sdl) sources.push({ kind: "sdl", text: setting.sdl });

    const probedLeases: ProbedLease[] = [];
    const statuses: ProbeStatus[] = [];

    for (const lease of leases) {
      const probed = await this.#probeLease(input.wallet, lease, sources);
      statuses.push(probed.status);
      if (probed.lease) probedLeases.push(probed.lease);
    }

    const signals = scanForSignals(sources, this.config.get("WORKLOAD_ABUSE_SIGNATURES"));

    return {
      verdict: toVerdict(signals),
      signals,
      excerpt: buildExcerpt(sources, signals),
      probeStatus: statuses.includes("probed") ? "probed" : statuses[0] ?? "stream_failed",
      leases: probedLeases
    };
  }

  async #findLiveLeases(owner: string, dseq: string): Promise<RpcLease[]> {
    const responses = await Promise.all(LIVE_LEASE_STATES.map(state => this.leaseHttpService.list({ owner, dseq, state })));

    return responses.flatMap(response => response.leases);
  }

  async #probeLease(wallet: WalletInitialized, lease: RpcLease, sources: EvidenceSource[]): Promise<{ status: ProbeStatus; lease?: ProbedLease }> {
    const { provider: providerAddress, dseq, gseq, oseq } = lease.lease.id;
    const provider = await this.providerRepository.findActiveByAddress(providerAddress);

    if (!provider) {
      this.logger.warn({ event: "TRIAL_WORKLOAD_PROBE_PROVIDER_UNKNOWN", dseq, provider: providerAddress });
      return { status: "provider_unknown" };
    }

    const auth = await this.providerService.toProviderAuth({ walletId: wallet.id, provider: providerAddress }, [...PROVIDER_SCOPES], {
      ttl: this.config.get("WORKLOAD_ABUSE_PROVIDER_JWT_TTL_SECONDS")
    });
    const services = await this.#findRunningServices(providerAddress, dseq, gseq, oseq, auth);
    const probedLease: ProbedLease = { provider: providerAddress, hostUri: provider.hostUri, gseq, oseq, services: services ?? [], shellStatuses: [] };

    if (!services) return { status: "status_unavailable", lease: probedLease };
    if (services.length === 0) return { status: "no_running_service", lease: probedLease };

    const target = { hostUri: provider.hostUri, providerAddress, token: auth.token, dseq, gseq, oseq };
    const probedServices = services.slice(0, MAX_PROBED_SERVICES_PER_LEASE);

    if (probedServices.length < services.length) {
      this.logger.warn({
        event: "TRIAL_WORKLOAD_PROBE_SERVICES_CAPPED",
        dseq,
        provider: providerAddress,
        reported: services.length,
        probed: probedServices.length
      });
    }

    for (const service of probedServices) {
      const shell = await this.shellProbeService.run({ ...target, service });
      probedLease.shellStatuses.push(shell.status);
      if (shell.output) sources.push({ kind: "shell", service, text: shell.output });
    }

    const logs = await this.logTailService.collect({ ...target, services: probedServices });
    probedLease.logStatus = logs.status;
    if (logs.lines.length > 0) sources.push({ kind: "logs", text: logs.lines.join("\n") });

    return { status: toLeaseProbeStatus(probedLease.shellStatuses), lease: probedLease };
  }

  async #findRunningServices(provider: string, dseq: string, gseq: number, oseq: number, auth: ProviderAuth): Promise<string[] | undefined> {
    try {
      const status = await this.providerService.getLeaseStatus(provider, dseq, gseq, oseq, auth);

      return Object.entries(status.services ?? {})
        .filter(([, service]) => (service?.available ?? 0) > 0)
        .map(([name]) => name);
    } catch (error) {
      this.logger.warn({ event: "TRIAL_WORKLOAD_PROBE_STATUS_UNAVAILABLE", dseq, provider, error });
      return undefined;
    }
  }
}

function toLeaseProbeStatus(shellStatuses: ShellProbeStatus[]): ProbeStatus {
  if (shellStatuses.some(status => status === "completed" || status === "output_capped" || status === "idle_timeout")) return "probed";
  if (shellStatuses.every(status => status === "shell_unavailable")) return "shell_unavailable";
  return "stream_failed";
}

function buildExcerpt(sources: EvidenceSource[], signals: DetectionSignal[]): string {
  const signalLines = signals.map(
    signal => `[${signal.bucket}/${signal.category}] ${signal.source}${signal.service ? `:${signal.service}` : ""}: ${signal.snippet}`
  );
  const shellOutput = sources.filter(source => source.kind === "shell").map(source => `--- shell ${source.service ?? ""}\n${source.text}`);

  return [...signalLines, ...shellOutput].join("\n").slice(0, MAX_EXCERPT_LENGTH);
}
