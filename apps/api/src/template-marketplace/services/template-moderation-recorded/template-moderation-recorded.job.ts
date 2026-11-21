import { type Job, JOB_NAME } from "@src/core";

/** Queued by admin-api in the transaction that records the event, so its name and payload are a contract with console-private. */
export class TemplateModerationRecorded implements Job {
  static readonly [JOB_NAME] = "TemplateModerationRecorded";
  readonly name = TemplateModerationRecorded[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { eventId: string }) {}
}

export function templateModerationRecordedKeyFor(eventId: string): string {
  return `templateModerationRecorded.${eventId}`;
}
