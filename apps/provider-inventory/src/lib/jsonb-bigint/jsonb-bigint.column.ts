import { customType } from "drizzle-orm/pg-core";

export const jsonbBigint = customType<{ data: unknown; driverData: unknown }>({
  dataType() {
    return "jsonb";
  },
  toDriver(value) {
    // Pass through: the postgres.js client serializes jsonb via serializeJsonb (see postgres.provider.ts),
    // which preserves bigints. drizzle.provider re-asserts that serializer after drizzle clobbers it.
    return value;
  },
  fromDriver(value) {
    // postgres.js parses jsonb via parseJsonb (see postgres.provider.ts); value is already parsed.
    return value;
  }
});
