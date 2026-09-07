import { z } from "@hono/zod-openapi";

import { isValidBech32Address } from "./addresses";

export const AkashAddressSchema = z.string().refine(val => isValidBech32Address(val, "akash"), { message: "Invalid address" });
export const AkashValidatorAddressSchema = z.string().refine(val => isValidBech32Address(val, "akashvaloper"), { message: "Invalid address" });

/** zod-to-openapi derives `^d+$` for bigint from an unescaped template literal, so the digit pattern is declared here instead. */
export const DseqSchema = z
  .bigint({ coerce: true })
  .positive()
  .transform(val => val.toString())
  .openapi({ pattern: "^\\d+$" });
