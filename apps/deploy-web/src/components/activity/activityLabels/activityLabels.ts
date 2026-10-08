/** A summary naming more deployments than this gets too long to read, so the rest are counted instead. */
const MAX_LISTED_DEPLOYMENTS = 3;

export function deploymentLabelOf(name: string | null, dseq: string | undefined): string {
  return name ? `“${name}”` : `deployment ${dseq}`;
}

export function listOf(labels: string[]): string {
  if (labels.length > MAX_LISTED_DEPLOYMENTS) return `${labels.slice(0, MAX_LISTED_DEPLOYMENTS).join(", ")} and ${labels.length - MAX_LISTED_DEPLOYMENTS} more`;

  return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
