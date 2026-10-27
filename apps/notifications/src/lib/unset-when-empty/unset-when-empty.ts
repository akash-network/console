import { z } from "zod";

type UnsetWhenEmpty<T extends z.ZodTypeAny> = z.ZodEffects<z.ZodOptional<T>, z.ZodOptional<T>["_output"], unknown>;

/** Left unset in some environments, where what it configures stays off instead of failing the boot. */
export function unsetWhenEmpty<T extends z.ZodTypeAny>(schema: T): UnsetWhenEmpty<T> {
  return z.preprocess(value => (value === "" ? undefined : value), schema.optional());
}
