import type { Context, Next } from "hono";

const MAX_CONTENT_TYPE_LENGTH = 100;

export const contentTypeMiddleware = (options: { supportedContentTypes: Set<string> }) =>
  async function enforceContentType(c: Context, next: Next) {
    let contentType = c.req.header("Content-Type");
    if (!contentType) {
      return c.json({ error: "Content-Type header is required" }, 400);
    }

    if (contentType.length > MAX_CONTENT_TYPE_LENGTH) {
      contentType = contentType.slice(0, MAX_CONTENT_TYPE_LENGTH);
    }

    const contentTypeIndex = contentType.indexOf(";");
    const contentTypeWithoutCharset = contentTypeIndex !== -1 ? contentType.slice(0, contentTypeIndex) : contentType;

    if (!options.supportedContentTypes.has(contentTypeWithoutCharset)) {
      return c.json({ error: "Unsupported Content-Type" }, 400);
    }

    await next();
  };
