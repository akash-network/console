## Prefer pg-boss over cron jobs for double writes and time-specific executions

## Description
- For work that must happen alongside a database write (a double write) or at/after a specific time, always prefer a pg-boss job over adding a new Kubernetes CronJob or CLI sweep command whenever possible.
- In `apps/api`, use `JobQueueService` (`apps/api/src/core/services/job-queue/job-queue.service.ts`): define a job + handler, and enqueue it where the triggering write happens.
- Why pg-boss:
  - Jobs live in the same Postgres database, so `enqueue` joins the ambient transaction of the domain write: the job and the write commit or roll back together, eliminating dual-write inconsistency.
  - Delayed / time-specific execution is built in (`startAfter` in enqueue options), so no additional cron job, helm values entry, or deploy pipeline change is needed.
  - Retries with backoff, queue policies, and observability come from the existing `JobQueueService` setup instead of per-cron-job wiring.
- Reach for a CronJob only when a queue job genuinely cannot express the work (e.g. an unbounded recurring sweep over rows that were never touched by an enqueue-capable code path).
