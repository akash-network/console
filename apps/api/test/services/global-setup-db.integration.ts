import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

import { setup as prepareTemplates } from "../global-setup-db";
import { markLastUsed } from "./stale-test-databases";
import { INDEXER_TEMPLATE_ENV_VAR, USER_TEMPLATE_ENV_VAR } from "./test-database-templates";

describe(prepareTemplates.name, () => {
  it.each(["tpl_console_api_user_", "tpl-console-api-"])("preserves databases owned by other runs with prefix %s", async prefix => {
    const { admin, template, clone } = setup({ prefix });

    try {
      await admin`CREATE DATABASE ${admin(template)}`;
      await admin`ALTER DATABASE ${admin(template)} WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`;

      await Promise.all([prepareTemplates(), prepareTemplates()]);

      await admin`CREATE DATABASE ${admin(clone)} TEMPLATE ${admin(template)}`;
      const databases = await admin<{ datname: string }[]>`SELECT datname FROM pg_database WHERE datname = ${clone}`;
      expect(databases).toEqual([{ datname: clone }]);
    } finally {
      try {
        await admin`DROP DATABASE IF EXISTS ${admin(clone)}`;
        const [existing] = await admin`SELECT datname FROM pg_database WHERE datname = ${template}`;
        if (existing) {
          await admin`ALTER DATABASE ${admin(template)} WITH IS_TEMPLATE false`;
          await admin`DROP DATABASE ${admin(template)}`;
        }
      } finally {
        await admin.end();
      }
    }
  });

  it("marks the templates it prepares as used", async () => {
    const { admin } = setup({ prefix: "unused_" });
    const startedAt = Date.now();

    try {
      await prepareTemplates();

      const names = [process.env[USER_TEMPLATE_ENV_VAR]!, process.env[INDEXER_TEMPLATE_ENV_VAR]!];
      const rows = await admin<{ comment: string }[]>`
        SELECT shobj_description(oid, 'pg_database') AS comment FROM pg_database WHERE datname IN ${admin(names)}
      `;
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(Date.parse(row.comment)).toBeGreaterThanOrEqual(startedAt - 1000);
      }
    } finally {
      await admin.end();
    }
  });

  it("drops test databases that killed runs left behind", async () => {
    const { admin } = setup({ prefix: "unused_" });
    const id = randomUUID().replaceAll("-", "");
    const perFile = `${id.slice(0, 8)}_test_user_leaked_${id.slice(8, 20)}`;
    const template = `tpl_console_api_indexer_${id.slice(20, 32)}`;
    const longAgo = new Date("2000-01-01T00:00:00.000Z");

    try {
      await admin`CREATE DATABASE ${admin(perFile)}`;
      await admin`CREATE DATABASE ${admin(template)}`;
      await admin`ALTER DATABASE ${admin(template)} WITH IS_TEMPLATE true ALLOW_CONNECTIONS false`;
      await markLastUsed(admin, perFile, longAgo);
      await markLastUsed(admin, template, longAgo);

      await prepareTemplates();

      const left = await admin`SELECT datname FROM pg_database WHERE datname IN ${admin([perFile, template])}`;
      expect(left).toEqual([]);
    } finally {
      try {
        for (const name of [perFile, template]) {
          await admin`ALTER DATABASE ${admin(name)} WITH IS_TEMPLATE false`.catch(() => {});
          await admin`DROP DATABASE IF EXISTS ${admin(name)}`;
        }
      } finally {
        await admin.end();
      }
    }
  });

  function setup({ prefix }: { prefix: string }) {
    const id = randomUUID().replaceAll("-", "");
    return {
      admin: postgres(process.env.POSTGRES_URI || "postgres://postgres:password@localhost:5432", { max: 1, onnotice: () => {} }),
      template: `${prefix}${id}`,
      clone: `template_regression_${id}`
    };
  }
});
