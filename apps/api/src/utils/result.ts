import type { Result } from "ts-results";

export const unwrapOrThrow = <T, E extends Error>(result: Result<T, E>): T => {
  if (result.err) {
    throw result.val;
  }
  return result.val;
};
