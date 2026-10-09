/** Shared by every row reporting the close of one deployment, whoever closed it, so the feed shows that close once. */
export function deploymentCloseDedupeKeyOf(dseq: string): string {
  return `deployment_close.${dseq}`;
}
