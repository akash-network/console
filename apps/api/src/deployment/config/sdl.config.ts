import { DEFAULT_BODY_LIMIT_BYTES } from "@src/core/config/body-limit.config";

/** Bounds the document the console keeps, in characters, and is the only thing bounding it since the column it is written to is `text`. */
export const SDL_MAX_LENGTH = 128 * 1024;

/** Bounds a submitted SDL on the field, because the create route's raised body limit would otherwise hand every SDL the room made for a seal. */
export const MAX_SUBMITTED_SDL_LENGTH = DEFAULT_BODY_LIMIT_BYTES;

/** Matches the `manifest_version` column, so a client-supplied expectation cannot reach a query unbounded. */
export const MAX_MANIFEST_VERSION_LENGTH = 64;

/** Published in the API reference as the name a later patch addresses the service by, so changing it breaks callers that created a deployment without an SDL. */
export const GENERATED_SERVICE_NAME = "app";
