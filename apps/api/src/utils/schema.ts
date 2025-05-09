import { z } from "zod";

import { isValidBech32Address } from "./addresses";

export const AkashAddressSchema = z.string().refine(val => isValidBech32Address(val, "akash"), { message: "Invalid address" });
