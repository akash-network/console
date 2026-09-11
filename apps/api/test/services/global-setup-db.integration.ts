import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

import { setup as prepareTemplates } from "../global-setup-db";

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

  function setup({ prefix }: { prefix: string }) {
    const id = randomUUID().replaceAll("-", "");
    return {
      admin: postgres(process.env.POSTGRES_URI || "postgres://postgres:password@localhost:5432", { max: 1, onnotice: () => {} }),
      template: `${prefix}${id}`,
      clone: `template_regression_${id}`
    };
  }
});
