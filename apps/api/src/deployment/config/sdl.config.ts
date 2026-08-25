/**
 * Upper bound on the SDL the console stores for a deployment. The column it is written to is `text`
 * and so bounds nothing itself, which makes this the only thing keeping a pathological SDL from
 * filling the database — and, because the document is measured against it before being serialized
 * rather than after, from filling memory on the way there. An SDL that does not fit is dropped, not
 * rejected: it still deploys, it is simply not remembered. Requests stay bounded separately, by the
 * 512 KB body limit `createRoute` puts on every route that can carry a body. Counted in characters
 * rather than bytes, since it is compared against a JavaScript string length. Sized roughly twenty
 * times above any SDL a real deployment needs.
 */
export const SDL_MAX_LENGTH = 128 * 1024;
