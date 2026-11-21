import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { Users } from "./user.schema";

describe("Users schema", () => {
  it("indexes the last fingerprint column", () => {
    const { indexes } = getTableConfig(Users);

    expect(indexes.map(({ config }) => ({ name: config.name, columns: config.columns.map(column => "name" in column && column.name) }))).toContainEqual({
      name: "userSetting_last_fingerprint_idx",
      columns: ["last_fingerprint"]
    });
  });

  it("indexes the account status column", () => {
    const { indexes } = getTableConfig(Users);

    expect(indexes.map(({ config }) => ({ name: config.name, columns: config.columns.map(column => "name" in column && column.name) }))).toContainEqual({
      name: "userSetting_account_status_idx",
      columns: ["account_status"]
    });
  });

  it("clears the last used organization when that organization is deleted", () => {
    const { foreignKeys } = getTableConfig(Users);

    expect(
      foreignKeys.map(foreignKey => {
        const { columns, foreignColumns, foreignTable } = foreignKey.reference();
        return {
          columns: columns.map(column => column.name),
          foreignTable: getTableConfig(foreignTable).name,
          foreignColumns: foreignColumns.map(column => column.name),
          onDelete: foreignKey.onDelete
        };
      })
    ).toContainEqual({ columns: ["last_used_organization_id"], foreignTable: "organizations", foreignColumns: ["id"], onDelete: "set null" });
  });

  it("keeps both organization limit overrides optional and positive", () => {
    const { columns, checks } = getTableConfig(Users);
    const dialect = new PgDialect();

    expect(
      columns.filter(column => column.name.endsWith("_limit")).map(column => ({ name: column.name, type: column.getSQLType(), notNull: column.notNull }))
    ).toEqual([
      { name: "team_organization_limit", type: "integer", notNull: false },
      { name: "projects_per_organization_limit", type: "integer", notNull: false }
    ]);
    expect(checks.map(check => ({ name: check.name, sql: dialect.sqlToQuery(check.value).sql }))).toEqual([
      { name: "userSetting_team_organization_limit_positive", sql: '"userSetting"."team_organization_limit" > 0' },
      { name: "userSetting_projects_per_organization_limit_positive", sql: '"userSetting"."projects_per_organization_limit" > 0' }
    ]);
  });
});
