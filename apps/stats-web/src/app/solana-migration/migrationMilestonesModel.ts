import type { MigrationCard } from "./solanaMigrationModel";

import { EMPTY_VALUE, formatCompact, formatNumber, formatPercent, formatShortDate, formatUsd } from "@/lib/statsFormat/statsFormat";
import type { SinkUnbondings, SinkUnbondingsCohort, SinkUnbondingsMilestone } from "@/types";

export type MigrationMilestoneMarker = { date: string; label: string };

export type UnbondingCohortRow = {
  key: string;
  name: string;
  period: string;
  delegators: string;
  unbonded: string;
  liquid: string;
  senders: string;
  sent: string;
  shareSent: string;
  isLiquid: boolean;
};

const FIRST_TRANSFER_LABEL = "First transfer";

const toAkt = (uakt: number) => uakt / 1e6;
const dayOf = (isoDate: string) => isoDate.slice(0, 10);

const dayStartOf = (date: string) => Date.parse(`${date}T00:00:00Z`);
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const shareOf = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : undefined);

export function toMilestoneCards(data: SinkUnbondings | undefined, aktPrice: number): MigrationCard[] {
  const usdOf = (akt: number) => (aktPrice > 0 ? formatUsd(akt * aktPrice, { compact: true }) : undefined);
  const milestones = data?.milestones ?? [];
  if (!milestones.length) return [];

  const milestoneCards = milestones.map(milestone => {
    const akt = toAkt(milestone.unbondedSinceUakt);
    const usd = usdOf(akt);

    return {
      label: `Unstaked since ${lowerFirst(milestone.label)}`,
      value: formatCompact(akt),
      unit: "AKT",
      detail: [`${formatNumber(milestone.delegatorsSince)} delegators`, usd].filter(Boolean).join(" · "),
      tooltip: `AKT unstaked from block ${formatNumber(milestone.height)} on, net of cancelled unbondings`
    };
  });

  const firstMilestone = lowerFirst(milestones[0].label);
  const conversion = sumLiquidConversion((data?.cohorts ?? []).filter(cohort => cohort.firstUnbondedAfter !== null));

  return [
    ...milestoneCards,
    {
      label: `Share migrated since ${firstMilestone}`,
      value: formatPercent(shareOf(conversion.sentFromLiquidUakt, conversion.liquidUakt)),
      detail: `${formatCompact(toAkt(conversion.sentFromLiquidUakt))} of ${formatCompact(toAkt(conversion.liquidUakt))} liquid AKT`,
      tooltip: `Share of the AKT first unstaked after the ${firstMilestone} that finished unbonding and was sent to Solana by the address that unstaked it`
    }
  ];
}

function sumLiquidConversion(cohorts: SinkUnbondingsCohort[]) {
  return {
    liquidUakt: cohorts.reduce((total, cohort) => total + cohort.liquidUakt, 0),
    sentFromLiquidUakt: cohorts.reduce((total, cohort) => total + cohort.sentFromLiquidUakt, 0)
  };
}

export function toMilestoneMarkers(data: SinkUnbondings | undefined): MigrationMilestoneMarker[] {
  if (!data) return [];

  const milestoneMarkers = (data.milestones ?? []).flatMap(milestone => (milestone.date ? [{ date: dayOf(milestone.date), label: milestone.label }] : []));
  const firstTransferDay = data.daily.find(day => day.sentToSolanaUakt > 0);

  return firstTransferDay ? [...milestoneMarkers, { date: firstTransferDay.date, label: FIRST_TRANSFER_LABEL }] : milestoneMarkers;
}

export function toUnbondingCohortRows(data: SinkUnbondings | undefined): UnbondingCohortRow[] {
  const milestones = data?.milestones ?? [];
  const cohorts = data?.cohorts ?? [];
  if (!milestones.length) return [];

  return cohorts.map((cohort, index) => {
    const isLiquid = cohort.liquidUakt > 0;

    return {
      key: cohort.firstUnbondedAfter ?? "beforeMilestones",
      name: cohortName(milestones, index),
      period: cohortPeriod(milestones, index),
      delegators: formatNumber(cohort.delegators),
      unbonded: formatCompact(toAkt(cohort.unbondedUakt)),
      liquid: isLiquid ? formatCompact(toAkt(cohort.liquidUakt)) : "Not yet",
      senders: formatNumber(cohort.senders),
      sent: formatCompact(toAkt(cohort.sentUakt)),
      shareSent: isLiquid ? formatPercent(shareOf(cohort.sentFromLiquidUakt, cohort.liquidUakt)) : EMPTY_VALUE,
      isLiquid
    };
  });
}

function cohortName(milestones: SinkUnbondingsMilestone[], index: number) {
  if (index === 0) return `Before ${lowerFirst(milestones[0].label)}`;
  if (index === milestones.length) return `After ${lowerFirst(milestones[index - 1].label)}`;

  return `${milestones[index - 1].label} → ${lowerFirst(milestones[index].label)}`;
}

function cohortPeriod(milestones: SinkUnbondingsMilestone[], index: number) {
  const startDate = milestones[index - 1]?.date;
  const endDate = milestones[index]?.date;
  const start = startDate && formatShortDate(dayStartOf(dayOf(startDate)));
  const end = endDate && formatShortDate(dayStartOf(dayOf(endDate)));

  if (start && end) return `${start} – ${end}`;
  if (end) return `Until ${end}`;
  if (start) return `Since ${start}`;

  return "";
}
