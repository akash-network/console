import { getTableConfig } from "drizzle-orm/pg-core";
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
});
