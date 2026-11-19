import { type Job, JOB_NAME } from "@src/core";

export class AskStillWanted implements Job {
  static readonly [JOB_NAME] = "AskStillWanted";
  readonly name = AskStillWanted[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { entryId: string }) {}
}
