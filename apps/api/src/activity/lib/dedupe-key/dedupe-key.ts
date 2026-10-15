/** Shared by every row reporting the close of one deployment, whoever closed it, so the feed shows that close once; a dseq names a deployment only within its owner. */
export function deploymentCloseDedupeKeyOf({ owner, dseq }: { owner: string; dseq: string }): string {
  return `deployment_close.${owner}.${dseq}`;
}
