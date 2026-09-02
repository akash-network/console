/**
 * What every route with a body accepts unless it asks for more, and the floor any route asking for more
 * is sized on top of. A leaf module on purpose: it is read both by the middleware that applies it and by
 * the config that sizes an exception to it, and neither should have to import the other.
 */
export const DEFAULT_BODY_LIMIT_BYTES = 512 * 1024;
