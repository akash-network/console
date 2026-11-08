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
});
