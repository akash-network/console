import { randomUUID } from "node:crypto";
import { type AddressInfo, createServer, type Socket } from "node:net";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { dropDatabases, findStaleTestDatabases, staleCutoff, sweepStaleTestDatabases } from "./stale-test-databases";

const HOUR = 60 * 60 * 1000;

describe("stale test databases", () => {
  const created: string[] = [];
  const admin = new Client({ connectionString: process.env.POSTGRES_BASE_URL });

  beforeAll(async () => {
    await admin.connect();
  });

  afterEach(async () => {
    for (const name of created.splice(0)) {
      await admin.query(`DROP DATABASE IF EXISTS ${admin.escapeIdentifier(name)} WITH (FORCE)`);
    }
  });

  afterAll(async () => {
    await admin.end();
  });

  describe(findStaleTestDatabases.name, () => {
    it.each(["event_broker", "notifications"])("returns a %s database whose run started before the cutoff", async kind => {
      const name = await createDatabase(perFileName({ kind, startedAt: Date.now() - 2 * HOUR }));

      expect(await findStaleTestDatabases(admin, new Date(Date.now() - HOUR))).toContain(name);
    });

    it("keeps a database whose run started after the cutoff", async () => {
      const name = await createDatabase(perFileName({ startedAt: Date.now() }));

      expect(await findStaleTestDatabases(admin, new Date(Date.now() - HOUR))).not.toContain(name);
    });

    it("keeps a database that a run is still connected to", async () => {
      const name = await createDatabase(perFileName({ startedAt: Date.now() - 2 * HOUR }));
      const client = await connectTo(name);

      try {
        expect(await findStaleTestDatabases(admin, new Date(Date.now() - HOUR))).not.toContain(name);
      } finally {
        await client.end();
      }
    });

    it.each(["test_other_1000000000000", "test_notifications_100000000000", "notifications_1000000000000"])(
      "never returns a database that only looks like a test database (%s_…)",
      async prefix => {
        const name = await createDatabase(`${prefix}_${uniqueSuffix()}`);

        expect(await findStaleTestDatabases(admin, new Date())).not.toContain(name);
      }
    );

    it("lists the oldest runs first", async () => {
      const newer = await createDatabase(perFileName({ startedAt: Date.now() - 2 * HOUR }));
      const older = await createDatabase(perFileName({ startedAt: Date.now() - 3 * HOUR }));

      const stale = await findStaleTestDatabases(admin, new Date(Date.now() - HOUR));

      expect(stale.indexOf(older)).toBeLessThan(stale.indexOf(newer));
    });
  });

  describe(dropDatabases.name, () => {
    it("drops the databases it is given", async () => {
      const first = await createDatabase(perFileName());
      const second = await createDatabase(perFileName());

      expect(await dropDatabases(admin, [first, second])).toEqual([first, second]);
      expect(await existing([first, second])).toEqual([]);
    });

    it("stops starting new drops once its deadline has passed", async () => {
      const name = await createDatabase(perFileName());

      expect(await dropDatabases(admin, [name], Date.now() - 1)).toEqual([]);
      expect(await existing([name])).toEqual([name]);
    });

    it("leaves a database a run connected to after the scan, and still drops the rest", async () => {
      const busy = await createDatabase(perFileName());
      const idle = await createDatabase(perFileName());
      const client = await connectTo(busy);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      try {
        expect(await dropDatabases(admin, [busy, idle])).toEqual([idle]);
        expect(await existing([busy, idle])).toEqual([busy]);
        expect(warn).toHaveBeenCalledWith(`Skipped dropping stale test database ${busy}:`, expect.any(Error));
      } finally {
        warn.mockRestore();
        await client.end();
      }
    });
  });

  describe(staleCutoff.name, () => {
    it("treats a run's databases as stale six hours after it started", () => {
      expect(staleCutoff(new Date("2026-03-10T12:00:00.000Z"))).toEqual(new Date("2026-03-10T06:00:00.000Z"));
    });
  });

  describe(sweepStaleTestDatabases.name, () => {
    it("drops databases left behind by a run that started long ago", async () => {
      const name = await createDatabase(perFileName({ startedAt: new Date("2001-09-09T01:46:40.000Z").getTime() }));

      await sweepStaleTestDatabases(process.env.POSTGRES_BASE_URL!);

      expect(await existing([name])).toEqual([]);
    });

    it("skips the sweep instead of failing the run when Postgres is unreachable", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      try {
        await expect(sweepStaleTestDatabases("postgres://127.0.0.1:1")).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith("Skipped dropping stale test databases:", expect.any(Error));
      } finally {
        warn.mockRestore();
      }
    });

    it("gives up instead of stalling the run when Postgres accepts the connection but never answers", async () => {
      const sockets: Socket[] = [];
      const silent = createServer(socket => sockets.push(socket));
      await new Promise<void>(resolve => silent.listen(0, "127.0.0.1", resolve));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      try {
        await expect(sweepStaleTestDatabases(`postgres://127.0.0.1:${(silent.address() as AddressInfo).port}`)).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith("Skipped dropping stale test databases:", expect.any(Error));
      } finally {
        warn.mockRestore();
        sockets.forEach(socket => socket.destroy());
        await new Promise(resolve => silent.close(resolve));
      }
    });
  });

  async function createDatabase(name: string) {
    created.push(name);
    await admin.query(`CREATE DATABASE ${admin.escapeIdentifier(name)}`);
    return name;
  }

  async function connectTo(name: string) {
    const url = new URL(process.env.POSTGRES_BASE_URL!);
    url.pathname = `/${name}`;
    const client = new Client({ connectionString: url.toString() });
    await client.connect();
    return client;
  }

  async function existing(names: string[]) {
    const { rows } = await admin.query<{ datname: string }>(`SELECT datname FROM pg_database WHERE datname = ANY($1) ORDER BY datname`, [names]);
    return rows.map(row => row.datname);
  }

  function perFileName({ kind = "notifications", startedAt = Date.now() }: { kind?: string; startedAt?: number } = {}) {
    return `test_${kind}_${startedAt}_sweep_${uniqueSuffix()}`;
  }

  function uniqueSuffix() {
    return randomUUID().replaceAll("-", "").slice(0, 12);
  }
});
