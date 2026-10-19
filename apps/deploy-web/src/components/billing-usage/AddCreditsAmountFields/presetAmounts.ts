export const PRESET_AMOUNTS_USD = [100, 500, 1000];

const MIN_SUGGESTED_RUNWAY_DAYS = 7;

const DAYS_IN_YEAR = 365;

export function suggestedPresetAmountUsd(deploymentDailyCostUsd: number | undefined): number | undefined {
  if (!deploymentDailyCostUsd) return undefined;
  return PRESET_AMOUNTS_USD.find(amountUsd => amountUsd / deploymentDailyCostUsd >= MIN_SUGGESTED_RUNWAY_DAYS);
}

export function deploymentRunwayOf(amountUsd: number, deploymentDailyCostUsd: number): string {
  const days = Math.floor(amountUsd / deploymentDailyCostUsd);
  if (days < 1) return "less than a day of this deployment";
  if (days >= DAYS_IN_YEAR) return "over a year of this deployment";
  return `about ${days} ${days === 1 ? "day" : "days"} of this deployment`;
}
