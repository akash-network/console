import { z } from "@hono/zod-openapi";

import { MAX_SUBMITTED_SDL_LENGTH } from "@src/deployment/config/sdl.config";
import { MAX_RUNTIME_LIMIT_HOURS } from "@src/deployment/http-schemas/runtime-limit";
import { MAX_DEPLOYMENT_NAME_LENGTH } from "@src/deployment/utils/deployment-name/deployment-name";
import { DseqSchema } from "@src/utils/schema";

/** A draft carries the SDL being edited and the one the session started from, so the body is sized for two of them. */
export const CONFIGURE_DRAFT_BODY_LIMIT_BYTES = 2 * MAX_SUBMITTED_SDL_LENGTH + 16 * 1024;

const MAX_PLACEMENT_NAME_LENGTH = 64;
const MAX_REGIONS_PER_PLACEMENT = 50;

export const ConfigureDraftParamsSchema = z.object({
  draftId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/)
    .openapi({ param: { name: "draftId", in: "path" }, description: "The id the client gave the draft when it started the session." })
});

const ConfigureDraftContentSchema = z.object({
  sdl: z.string().min(1).max(MAX_SUBMITTED_SDL_LENGTH).openapi({ description: "The SDL being edited, with secret values replaced by their references." }),
  startingSdl: z.string().max(MAX_SUBMITTED_SDL_LENGTH).optional().openapi({ description: "The SDL the session started from, which a reset goes back to." }),
  name: z.string().max(MAX_DEPLOYMENT_NAME_LENGTH).optional(),
  runtimeLimitHours: z.number().int().min(1).max(MAX_RUNTIME_LIMIT_HOURS).optional(),
  inheritSecretsFrom: DseqSchema.optional().openapi({ description: "The deployment whose secrets a redeploy carries forward." }),
  placementRegions: z
    .record(z.string().max(MAX_PLACEMENT_NAME_LENGTH), z.array(z.string().max(MAX_PLACEMENT_NAME_LENGTH)).max(MAX_REGIONS_PER_PLACEMENT))
    .optional()
    .openapi({ description: "Regions picked per placement beyond the one the SDL can carry." })
});

export const UpdateConfigureDraftRequestSchema = z.object({ data: ConfigureDraftContentSchema });

export const ConfigureDraftResponseSchema = z.object({
  data: ConfigureDraftContentSchema.extend({
    draftId: z.string(),
    updatedAt: z.string().datetime()
  })
});

export type ConfigureDraftContentInput = z.infer<typeof ConfigureDraftContentSchema>;
export type ConfigureDraftResponse = z.infer<typeof ConfigureDraftResponseSchema>;
