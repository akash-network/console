import { type Job, JOB_NAME } from "@src/core";

export class ResolveTemplateVersionImageDigests implements Job {
  static readonly [JOB_NAME] = "ResolveTemplateVersionImageDigests";
  readonly name = ResolveTemplateVersionImageDigests[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { versionId: string }) {}
}

export function resolveTemplateVersionImageDigestsKeyFor(versionId: string): string {
  return `resolveTemplateVersionImageDigests.${versionId}`;
}
