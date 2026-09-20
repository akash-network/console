import { isBehaviouralCandidate } from "./evaluate-behavioural-signals";
import type { BehaviouralFinding } from "./types";

const COLLECTED_PROBE_STATUS = "probed";
const MS_PER_MINUTE = 60_000;

export type AgreementRow = {
  service: string;
  createdAt: Date;
  probeStatus: string;
  behaviouralFindings: BehaviouralFinding[] | null;
};

export type BehaviouralAgreement = {
  agreed: boolean;
  service: string | null;
  streak: number;
  spanMinutes: number;
};

export type AgreementParams = {
  agreementProbes: number;
  minWindowMinutes: number;
  now?: Date;
};

/** A probe that could not collect anything neither advances nor breaks the streak, because a flaking provider would otherwise put agreement out of reach. */
export function findBehaviouralAgreement(rows: AgreementRow[], params: AgreementParams): BehaviouralAgreement {
  const now = params.now ?? new Date();
  const perService = [...groupByService(rows).values()].map(serviceRows => measureService(serviceRows, params, now));

  return perService.reduce(pickStrongest, { agreed: false, service: null, streak: 0, spanMinutes: 0 });
}

function groupByService(rows: AgreementRow[]): Map<string, AgreementRow[]> {
  const grouped = new Map<string, AgreementRow[]>();

  for (const row of rows) {
    const serviceRows = grouped.get(row.service) ?? [];
    serviceRows.push(row);
    grouped.set(row.service, serviceRows);
  }

  return grouped;
}

function measureService(rows: AgreementRow[], params: AgreementParams, now: Date): BehaviouralAgreement {
  const newestFirst = [...rows].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const streak: AgreementRow[] = [];

  for (const row of newestFirst) {
    if (row.probeStatus !== COLLECTED_PROBE_STATUS) continue;
    if (!isBehaviouralCandidate(row.behaviouralFindings ?? [])) break;
    streak.push(row);
  }

  const oldest = streak.at(-1);
  const spanMinutes = oldest ? Math.floor((now.getTime() - oldest.createdAt.getTime()) / MS_PER_MINUTE) : 0;

  return {
    agreed: streak.length >= params.agreementProbes && spanMinutes >= params.minWindowMinutes,
    service: newestFirst[0]?.service ?? null,
    streak: streak.length,
    spanMinutes
  };
}

function pickStrongest(strongest: BehaviouralAgreement, candidate: BehaviouralAgreement): BehaviouralAgreement {
  if (candidate.agreed !== strongest.agreed) return candidate.agreed ? candidate : strongest;

  return candidate.streak > strongest.streak ? candidate : strongest;
}
