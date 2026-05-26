import { customType } from "drizzle-orm/pg-core";

export const jsonbBigint = customType<{ data: unknown; driverData: unknown }>({
  dataType() {
    return "jsonb";
  },
  toDriver(value) {
    // pass value as is because then it's handled by postgres.js jsonb serializer
    return value;
  },
  fromDriver(value) {
    // postgres.js returns parsed JSON
    return value;
  }
});
