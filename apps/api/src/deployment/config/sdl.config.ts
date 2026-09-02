import { DEFAULT_BODY_LIMIT_BYTES } from "@src/core/config/body-limit.config";

/**
 * Upper bound on the SDL the console stores for a deployment. The column it is written to is `text`
 * and so bounds nothing itself, which makes this the only thing keeping a pathological SDL from
 * filling the database — and, because the document is measured against it before being serialized
 * rather than after, from filling memory on the way there.
 *
 * An SDL that does not fit is rejected with a 400 and nothing is created, rather than deployed with no
 * record of what it is. A deployment the console cannot describe is one nobody can later reproduce,
 * redeploy, or attach sealed secrets to, so the two are never allowed to disagree.
 *
 * This bounds the stripped document, which is a different and smaller thing than the SDL that arrived,
 * and it is checked only after that document has been parsed and re-serialized. What bounds the arriving
 * one is `MAX_SUBMITTED_SDL_LENGTH` below — not the route's body limit, which `POST /v1/deployments`
 * raises to carry a seal and which in any case bounds the whole request rather than this one field.
 *
 * Counted in characters rather than bytes, since it is compared against a JavaScript string length.
 * Sized roughly twenty times above any SDL a real deployment needs.
 */
export const SDL_MAX_LENGTH = 128 * 1024;

/**
 * Upper bound on the SDL a request may *submit*, as opposed to the stripped one the console keeps. It has
 * to be stated on the field rather than left to the route's body limit, because that limit bounds the
 * whole body and `POST /v1/deployments` raises it to make room for a seal — which would otherwise hand
 * every SDL the same larger allowance and put a document five times the old size through two YAML parses,
 * two manifest generations and a `js-yaml` dump before anything refused it. The anchor-bomb estimator in
 * `stripSdlSecrets` is sized against this, so raising it re-sizes that guard too.
 *
 * Held at the default allowance every route with a body has, which is exactly what bounded a submitted SDL
 * before the create route asked for more. Characters rather than bytes, to match `SDL_MAX_LENGTH` and the
 * `z.string().max` that applies it.
 */
export const MAX_SUBMITTED_SDL_LENGTH = DEFAULT_BODY_LIMIT_BYTES;
