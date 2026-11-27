import type { TemplateInsightHint } from "@src/types/marketplace-template";

export type HintCopy = { title: string; body: string };

/** Below this a whole percent rounds a low rate up to its threshold, so it keeps a decimal. */
const ONE_DECIMAL_BELOW = 0.1;

export function formatShare(share: number): string {
  const percent = share * 100;

  return share < ONE_DECIMAL_BELOW && share > 0 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
}

export function describeHint({ kind, value, previousValue, version }: TemplateInsightHint): HintCopy {
  const share = formatShare(value);
  const earlierShare = previousValue === null ? "" : formatShare(previousValue);

  switch (kind) {
    case "few_get_a_provider":
      return {
        title: "Many deployments don't get a provider",
        body: `Only ${share} of the deployments in this period got a provider. Providers may not have what the template asks for, or the price may be too low. Try asking for less CPU, memory or GPU, or raising the price.`
      };
    case "few_still_running":
      return {
        title: "Many deployments stop within a day",
        body: `Only ${share} were still running 24 hours after they got a provider. Check that the image starts on its own, that its command is right, and that the values you ask for have sensible defaults.`
      };
    case "latest_version_gets_fewer_providers":
      return {
        title: `Version ${version} gets a provider less often`,
        body: `${share} of its deployments got a provider, against ${earlierShare} for the version before it. Check what changed in its resources or price.`
      };
    case "latest_version_stops_more":
      return {
        title: `Version ${version} stops running more often`,
        body: `${share} of its deployments were still running after 24 hours, against ${earlierShare} for the version before it. Check what changed in its image or settings.`
      };
    case "few_viewers_deploy":
      return {
        title: "People look but few deploy",
        body: `${share} of the people who viewed it went on to deploy it. A title, summary and README that say what the template does and what it needs can help.`
      };
    case "deploys_growing":
      return {
        title: "Deploys are growing",
        body: `${value} deploys in this period, up from ${previousValue ?? 0} in the period before.`
      };
    case "running_well":
      return {
        title: "Deployments keep running",
        body: `${share} of deployments were still running 24 hours after they got a provider.`
      };
  }
}

export function describeChange(current: number, previous: number, days: number): string {
  const period = `the previous ${days} days`;

  if (previous === 0) return current === 0 ? `None in ${period} either` : `None in ${period}`;
  if (current === previous) return `Same as ${period}`;

  const change = Math.round(((current - previous) / previous) * 100);

  return `${change > 0 ? "+" : "−"}${Math.abs(change)}% vs ${period}`;
}
