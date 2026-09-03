import { DEFAULT_BODY_LIMIT_BYTES } from "@src/core/config/body-limit.config";

/** Bounds the stripped document the console keeps, in characters, and is the only thing bounding it since the column it is written to is `text`. */
export const SDL_MAX_LENGTH = 128 * 1024;

/** Bounds a submitted SDL on the field, because the create route's raised body limit would otherwise hand every SDL the room made for a seal. */
export const MAX_SUBMITTED_SDL_LENGTH = DEFAULT_BODY_LIMIT_BYTES;
