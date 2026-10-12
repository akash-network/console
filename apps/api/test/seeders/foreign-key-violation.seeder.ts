import { PostgresError } from "postgres";

export function createForeignKeyViolation(constraintName: string): Error {
  const driverError = Object.assign(Object.create(PostgresError.prototype), {
    name: "PostgresError",
    code: "23503",
    constraint_name: constraintName,
    message: `insert or update on table violates foreign key constraint "${constraintName}"`
  });

  return new Error("Failed query", { cause: driverError });
}
