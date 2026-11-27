import { type Job, JOB_NAME } from "@src/core";

/** Tells the publishers of public templates how their templates did in the week that ended on the given UTC day, and which passed a deploy milestone. */
export class SendTemplatePublisherDigest implements Job {
  static readonly [JOB_NAME] = "SendTemplatePublisherDigest";
  readonly name = SendTemplatePublisherDigest[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { weekEndsOn: string }) {}
}

export function sendTemplatePublisherDigestKeyFor(weekEndsOn: string): string {
  return `sendTemplatePublisherDigest.${weekEndsOn}`;
}
