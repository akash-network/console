import "./setup-env";

import { sweepStaleTestDatabases } from "./services/stale-test-databases";

/** Drops the per-file databases of earlier runs that were killed before their afterAll could. */
export async function setup(): Promise<void> {
  if (process.env.POSTGRES_BASE_URL) {
    await sweepStaleTestDatabases(process.env.POSTGRES_BASE_URL);
  }
}
