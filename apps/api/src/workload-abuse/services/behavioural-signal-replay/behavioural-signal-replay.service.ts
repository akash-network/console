import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { evaluateBehaviouralSignals, isBehaviouralCandidate } from "@src/workload-abuse/lib/behavioural-signals/evaluate-behavioural-signals";
import { BEHAVIOURAL_SIGNALS, type BehaviouralSignalParams, type ProbeEvidenceSnapshot } from "@src/workload-abuse/lib/behavioural-signals/types";
import { WorkloadProbeEvidenceRepository } from "@src/workload-abuse/repositories/workload-probe-evidence/workload-probe-evidence.repository";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { type BehaviouralReplayFixture, BUNDLED_REPLAY_FIXTURES } from "./fixtures";

const DEFAULT_WINDOW_DAYS = 30;
const AGREEMENT_SWEEP = [1, 2, 3, 5];
const THRESHOLD_SWEEP_FACTORS = [0.5, 1, 2];

export type BehaviouralReplayOptions = {
  since?: Date;
  until?: Date;
  fixturePaths?: string[];
  bundledFixtures?: boolean;
  accelMinVramMb?: number;
  artifactMinMb?: number;
};

export type BehaviouralReplayDeployment = {
  source: "database" | "fixture";
  label: string;
  probes: number;
  accelFires: number;
  networkFires: number;
  candidateProbes: number;
  longestAgreement: number;
};

export type BehaviouralReplaySummary = {
  params: BehaviouralSignalParams;
  window: { since: string; until: string } | null;
  deployments: BehaviouralReplayDeployment[];
  wouldEnforce: Array<{ agreementProbes: number; deployments: number }>;
  sensitivity: Array<{ accelMinVramMb: number; artifactMinMb: number; candidateDeployments: number }>;
};

type SnapshotSeries = { source: "database" | "fixture"; label: string; snapshots: ProbeEvidenceSnapshot[] };

/** Reads recorded evidence and never writes, so an operator can re-score a window as often as they like. */
@singleton()
export class BehaviouralSignalReplayService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly evidenceRepository: WorkloadProbeEvidenceRepository,
    private readonly config: WorkloadAbuseConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: BehaviouralSignalReplayService.name });
  }

  async replay(options: BehaviouralReplayOptions = {}): Promise<BehaviouralReplaySummary> {
    const params = this.#readParams(options);
    const fixtureSeries = await this.#loadFixtures(options);
    const usesDatabase = fixtureSeries.length === 0 || Boolean(options.since);
    const window = usesDatabase ? this.#resolveWindow(options) : null;
    const databaseSeries = window ? await this.#loadFromDatabase(window) : [];
    const series = [...databaseSeries, ...fixtureSeries];

    const deployments = series.map(entry => this.#summarise(entry, params));

    for (const deployment of deployments) {
      this.logger.info({ event: "BEHAVIOURAL_REPLAY_DEPLOYMENT", ...deployment });
    }

    const summary: BehaviouralReplaySummary = {
      params,
      window: window ? { since: window.since.toISOString(), until: window.until.toISOString() } : null,
      deployments,
      wouldEnforce: AGREEMENT_SWEEP.map(agreementProbes => ({
        agreementProbes,
        deployments: deployments.filter(deployment => deployment.longestAgreement >= agreementProbes).length
      })),
      sensitivity: this.#sweepThresholds(series, params)
    };

    this.logger.info({
      event: "BEHAVIOURAL_REPLAY_COMPLETED",
      window: summary.window,
      deployments: deployments.length,
      probes: deployments.reduce((total, deployment) => total + deployment.probes, 0),
      candidateDeployments: deployments.filter(deployment => deployment.candidateProbes > 0).length,
      wouldEnforce: summary.wouldEnforce
    });

    return summary;
  }

  #readParams(options: BehaviouralReplayOptions): BehaviouralSignalParams {
    return {
      accelMinVramMb: options.accelMinVramMb ?? this.config.get("WORKLOAD_ABUSE_SIGNAL_ACCEL_MIN_VRAM_MB"),
      artifactMinMb: options.artifactMinMb ?? this.config.get("WORKLOAD_ABUSE_SIGNAL_ARTIFACT_MIN_MB"),
      relayEndpoints: this.config.get("WORKLOAD_ABUSE_SIGNAL_RELAY_ENDPOINTS")
    };
  }

  #resolveWindow(options: BehaviouralReplayOptions): { since: Date; until: Date } {
    const until = options.until ?? new Date();
    const since = options.since ?? new Date(until.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    return { since, until };
  }

  async #loadFromDatabase(window: { since: Date; until: Date }): Promise<SnapshotSeries[]> {
    const rows = await this.evidenceRepository.findCreatedBetween(window);
    const byDeployment = new Map<string, SnapshotSeries>();

    for (const row of rows) {
      const label = `${row.walletId}/${row.dseq}/${row.service}`;
      const series = byDeployment.get(label) ?? { source: "database" as const, label, snapshots: [] };
      series.snapshots.push(row);
      byDeployment.set(label, series);
    }

    return [...byDeployment.values()];
  }

  async #loadFixtures(options: BehaviouralReplayOptions): Promise<SnapshotSeries[]> {
    const bundled = options.bundledFixtures ? BUNDLED_REPLAY_FIXTURES : [];
    const loaded: BehaviouralReplayFixture[] = [];

    for (const path of options.fixturePaths ?? []) {
      loaded.push(...(await readFixtures(path)));
    }

    return [...bundled, ...loaded].map(fixture => ({ source: "fixture" as const, label: fixture.deployment, snapshots: fixture.snapshots }));
  }

  #summarise(series: SnapshotSeries, params: BehaviouralSignalParams): BehaviouralReplayDeployment {
    const findingsPerSnapshot = series.snapshots.map(snapshot => evaluateBehaviouralSignals(snapshot, params));
    const signalsPerSnapshot = findingsPerSnapshot.map(findings => new Set(findings.map(finding => finding.signal)));

    return {
      source: series.source,
      label: series.label,
      probes: series.snapshots.length,
      accelFires: signalsPerSnapshot.filter(signals => signals.has(BEHAVIOURAL_SIGNALS.accelWithoutArtifacts)).length,
      networkFires: signalsPerSnapshot.filter(signals => signals.has(BEHAVIOURAL_SIGNALS.networkIsolated)).length,
      candidateProbes: findingsPerSnapshot.filter(isBehaviouralCandidate).length,
      longestAgreement: findLongestAgreement(findingsPerSnapshot.map(isBehaviouralCandidate))
    };
  }

  #sweepThresholds(series: SnapshotSeries[], params: BehaviouralSignalParams): BehaviouralReplaySummary["sensitivity"] {
    return THRESHOLD_SWEEP_FACTORS.flatMap(accelFactor =>
      THRESHOLD_SWEEP_FACTORS.map(artifactFactor => {
        const swept: BehaviouralSignalParams = {
          ...params,
          accelMinVramMb: Math.round(params.accelMinVramMb * accelFactor),
          artifactMinMb: Math.round(params.artifactMinMb * artifactFactor)
        };

        return {
          accelMinVramMb: swept.accelMinVramMb,
          artifactMinMb: swept.artifactMinMb,
          candidateDeployments: series.filter(entry => this.#summarise(entry, swept).candidateProbes > 0).length
        };
      })
    );
  }
}

async function readFixtures(path: string): Promise<BehaviouralReplayFixture[]> {
  const entries = await readdir(path).catch(() => null);

  if (!entries) return [await readFixtureFile(path)];

  const files = entries.filter(entry => entry.endsWith(".json"));

  return await Promise.all(files.map(file => readFixtureFile(join(path, file))));
}

async function readFixtureFile(path: string): Promise<BehaviouralReplayFixture> {
  return JSON.parse(await readFile(path, "utf8")) as BehaviouralReplayFixture;
}

function findLongestAgreement(candidates: boolean[]): number {
  let longest = 0;
  let current = 0;

  for (const candidate of candidates) {
    current = candidate ? current + 1 : 0;
    longest = Math.max(longest, current);
  }

  return longest;
}
