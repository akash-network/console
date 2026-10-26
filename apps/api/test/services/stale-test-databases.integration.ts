import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { dropDatabases, findStaleTestDatabases, markLastUsed, staleCutoffs, sweepStaleTestDatabases } from "./stale-test-databases";

const HOUR = 60 * 60 * 1000;
const POSTGRES_URI = process.env.POSTGRES_URI || "postgres://postgres:password@localhost:5432";

describe("stale test databases", () => {
  const created: string[] = [];
  const admin = postgres(POSTGRES_URI, { max: 3, onnotice: () => {} });

  afterEach(async () => {
    for (const name of created.splice(0)) {
      await admin`ALTER DATABASE ${admin(name)} WITH IS_TEMPLATE false ALLOW_CONNECTIONS true`.catch(() => {});
      await admin`DROP DATABASE IF EXISTS ${admin(name)} WITH (FORCE)`;
    }
  });

  afterAll(async () => {
    await admin.end();
  });

  describe(findStaleTestDatabases.name, () => {
    it("returns a per-file test database created before the cutoff that nobody is connected to", async () => {
      const name = await createDatabase(perFileName());

      expect(await findStaleTestDatabases(admin, cutoffs({ perFile: inOneHour() }))).toContain(name);
    });

    it("keeps a per-file test database created after the cutoff", async () => {
      const name = await createDatabase(perFileName());

      expect(await findStaleTestDatabases(admin, cutoffs({ perFile: oneHourAgo() }))).not.toContain(name);
    });

    it("keeps a per-file test database that a run is still connected to", async () => {
      const name = await createDatabase(perFileName());
      const client = postgres(`${POSTGRES_URI}/${name}`, { max: 1 });

      try {
        await client`SELECT 1`;
        expect(await findStaleTestDatabases(admin, cutoffs({ perFile: inOneHour() }))).not.toContain(name);
      } finally {
        await client.end();
      }
    });

    it.each(["indexer", "user"])("matches per-file databases of the %s role", async role => {
      const name = await createDatabase(perFileName(role));

      expect(await findStaleTestDatabases(admin, cutoffs({ perFile: inOneHour() }))).toContain(name);
    });

    it.each(["chain_indexer_sweep", "test_user_sweep", "1234567_test_user_sweep", "abcdefgh_test_user_sweep"])(
      "never returns a database that only looks like a test database (%s_…)",
      async prefix => {
        const name = await createDatabase(`${prefix}_${uniqueSuffix()}`);

        expect(await findStaleTestDatabases(admin, cutoffs({ perFile: inOneHour(), template: inOneHour() }))).not.toContain(name);
      }
    );

    it("returns a template whose last use is older than the cutoff, even if it was created recently", async () => {
      const name = await createTemplate(templateName());
      await markLastUsed(admin, name, new Date(Date.now() - 30 * 24 * HOUR));

      expect(await findStaleTestDatabases(admin, cutoffs({ template: oneHourAgo() }))).toContain(name);
    });

    it("keeps a template used after the cutoff", async () => {
      const name = await createTemplate(templateName());
      await markLastUsed(admin, name);

      expect(await findStaleTestDatabases(admin, cutoffs({ template: oneHourAgo() }))).not.toContain(name);
    });

    it("falls back to the creation time for a template that was never marked as used", async () => {
      const name = await createTemplate(templateName());

      expect(await findStaleTestDatabases(admin, cutoffs({ template: inOneHour() }))).toContain(name);
      expect(await findStaleTestDatabases(admin, cutoffs({ template: oneHourAgo() }))).not.toContain(name);
    });

    it("keeps the templates the current run needs, however old", async () => {
      const name = await createTemplate(templateName());
      await markLastUsed(admin, name, new Date(Date.now() - 30 * 24 * HOUR));

      expect(await findStaleTestDatabases(admin, cutoffs({ template: inOneHour(), keepTemplates: [name] }))).not.toContain(name);
    });

    it("ages per-file databases and templates against their own cutoffs", async () => {
      const perFile = await createDatabase(perFileName());
      const template = await createTemplate(templateName());

      const stale = await findStaleTestDatabases(admin, cutoffs({ perFile: inOneHour(), template: oneHourAgo() }));

      expect(stale).toContain(perFile);
      expect(stale).not.toContain(template);
    });
  });

  describe(dropDatabases.name, () => {
    it("drops per-file databases and templates", async () => {
      const perFile = await createDatabase(perFileName());
      const template = await createTemplate(templateName());

      expect(await dropDatabases(admin, [perFile, template])).toEqual([perFile, template]);
      expect(await existing([perFile, template])).toEqual([]);
    });

    it("stops starting new drops once its deadline has passed", async () => {
      const name = await createDatabase(perFileName());

      expect(await dropDatabases(admin, [name], Date.now() - 1)).toEqual([]);
      expect(await existing([name])).toEqual([name]);
    });

    it("leaves a database a run connected to after the scan, and still drops the rest", async () => {
      const busy = await createDatabase(perFileName());
      const idle = await createDatabase(perFileName());
      const client = postgres(`${POSTGRES_URI}/${busy}`, { max: 1 });

      try {
        await client`SELECT 1`;

        expect(await dropDatabases(admin, [busy, idle])).toEqual([idle]);
        expect(await existing([busy, idle])).toEqual([busy]);
      } finally {
        await client.end();
      }
    });
  });

  describe(staleCutoffs.name, () => {
    it("treats per-file databases as stale after six hours and templates after a week unused", () => {
      const now = new Date("2026-03-10T12:00:00.000Z");

      expect(staleCutoffs(now)).toEqual({
        perFileCutoff: new Date("2026-03-10T06:00:00.000Z"),
        templateCutoff: new Date("2026-03-03T12:00:00.000Z")
      });
    });
  });

  describe(sweepStaleTestDatabases.name, () => {
    it("skips the sweep instead of failing the run when Postgres refuses it", async () => {
      const closed = postgres(POSTGRES_URI, { max: 1 });
      await closed.end();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      try {
        await expect(sweepStaleTestDatabases(closed, [])).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith("Skipped dropping stale test databases:", expect.any(Error));
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe(markLastUsed.name, () => {
    it("records when a template was last used", async () => {
      const name = await createTemplate(templateName());
      const at = new Date("2026-01-02T03:04:05.000Z");

      await markLastUsed(admin, name, at);

      const [row] = await admin<{ comment: string }[]>`
        SELECT shobj_description(oid, 'pg_database') AS comment FROM pg_database WHERE datname = ${name}
      `;
      expect(row.comment).toBe(at.toISOString());
    });
  });

  async function createDatabase(name: string) {
    created.push(name);
    await admin`CREATE DATABASE ${admin(name)}`;
    return name;
  }

  async function createTemplate(name: string) {
    await createDatabase(name);
    await admin`ALTER DATABASE ${admin(name)} WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`;
    return name;
  }

  async function existing(names: string[]) {
    const rows = await admin<{ datname: string }[]>`SELECT datname FROM pg_database WHERE datname IN ${admin(names)} ORDER BY datname`;
    return rows.map(row => row.datname);
  }

  function perFileName(role = "user") {
    return `${randomUUID().slice(0, 8)}_test_${role}_sweep_${uniqueSuffix()}`;
  }

  function templateName() {
    return `tpl_console_api_user_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  }

  function uniqueSuffix() {
    return randomUUID().replaceAll("-", "").slice(0, 12);
  }

  function cutoffs({ perFile = oneHourAgo(), template = oneHourAgo(), keepTemplates = [] as string[] }) {
    return { perFileCutoff: perFile, templateCutoff: template, keepTemplates };
  }

  function inOneHour() {
    return new Date(Date.now() + HOUR);
  }

  function oneHourAgo() {
    return new Date(Date.now() - HOUR);
  }
});
