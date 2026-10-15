import { isApiError } from "@akashnetwork/openapi-sdk";
import { z } from "zod";

const limitBodySchema = z.object({ data: z.object({ limit: z.number().int().positive() }) });

export function readRefusedLimit(cause: unknown): number | undefined {
  const parsed = limitBodySchema.safeParse(isApiError(cause) ? cause.body : null);

  return parsed.success ? parsed.data.data.limit : undefined;
}
