import { BlaStarted } from "@src/billing/events/trial-started";
import { JobHandler, JobPayload } from "@src/core/services/job-queue/job-queue.service";
import { singleton } from "tsyringe";

@singleton()
export class BlaStartedHandler implements JobHandler<BlaStarted> {
  accepts = BlaStarted;

  constructor() {}

  async handle(event: JobPayload<BlaStarted>): Promise<void> {
    console.log('<-------------------------- handling BlaStarted event -------------------------->');
    console.log('BlaStarted event data:', event);
    console.log('<-------------------------- BlaStarted event handled -------------------------->');
  }
}
