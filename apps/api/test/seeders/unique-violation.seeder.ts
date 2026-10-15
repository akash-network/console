import { PostgresError } from "postgres";

export function createUniqueViolation(constraintName: string): Error {
  const driverError = Object.assign(Object.create(PostgresError.prototype), {
    name: "PostgresError",
    code: "23505",
    constraint_name: constraintName,
    message: `duplicate key value violates unique constraint "${constraintName}"`
  });

  return new Error("Failed query", { cause: driverError });
}
