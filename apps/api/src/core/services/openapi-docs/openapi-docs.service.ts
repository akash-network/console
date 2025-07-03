import { LoggerService } from "@akashnetwork/logging";

import { env } from "@src/utils/env";
import type { OpenApiHonoHandler } from "../open-api-hono-handler/open-api-hono-handler";

const logger = LoggerService.forContext("OpenApiDocsService");

export class OpenApiDocsService {
  generateDocs(handlers: OpenApiHonoHandler[]) {
    const version = "v1";
    const docs = {
      openapi: "3.0.0",
      servers: [{ url: `${env.SERVER_ORIGIN}/${version}` }],
      info: {
        title: "Console API",
        description: "Access Akash data from our indexer",
        version: version
      },
      paths: {},
      components: {}
    };

    for (const handler of handlers) {
      try {
        const handlerDocs = handler.getOpenAPIDocument({
          openapi: "3.0.0",
          info: {
            title: "Unified API",
            version: "1.0.0"
          }
        });

        Object.assign(docs.paths, handlerDocs.paths);
      } catch (error) {
        logger.error({
          name: `Error generating OpenAPI docs for handler, example path: ${handler.routes[0]?.path || "unknown"}`,
          error
        });
      }
    }

    return docs;
  }
}
