import { z } from "@hono/zod-openapi";

import { isValidBech32Address } from "./addresses";

export const AkashAddressSchema = z.string().refine(val => isValidBech32Address(val, "akash"), { message: "Invalid address" });
export const AkashValidatorAddressSchema = z.string().refine(val => isValidBech32Address(val, "akashvaloper"), { message: "Invalid address" });

/** zod-to-openapi derives `^d+$` for bigint from an unescaped template literal, so the pattern is declared here, and it excludes the zero `.positive()` rejects. */
export const DseqSchema = z
  .bigint({ coerce: true })
  .positive()
  .transform(val => val.toString())
  .openapi({ pattern: "^0*[1-9]\\d*$" });
