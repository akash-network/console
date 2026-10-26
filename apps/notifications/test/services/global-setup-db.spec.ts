import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

import { setup as sweepOnStart } from "../global-setup-db";

describe(sweepOnStart.name, () => {
  it("drops test databases that killed runs left behind", async () => {
    const admin = new Client({ connectionString: process.env.POSTGRES_BASE_URL });
    const leaked = `test_event_broker_${new Date("2001-09-09T01:46:40.000Z").getTime()}_leaked_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    await admin.connect();

    try {
      await admin.query(`CREATE DATABASE ${admin.escapeIdentifier(leaked)}`);

      await sweepOnStart();

      const { rows } = await admin.query(`SELECT datname FROM pg_database WHERE datname = $1`, [leaked]);
      expect(rows).toEqual([]);
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS ${admin.escapeIdentifier(leaked)}`);
      await admin.end();
    }
  });
});
