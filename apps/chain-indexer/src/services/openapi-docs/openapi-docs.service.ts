import type { OpenAPIHono } from "@hono/zod-openapi";
import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { OpenApiHonoHandler } from "@src/services/open-api-hono-handler/open-api-hono-handler";

export type OpenApiDocument = ReturnType<OpenAPIHono["getOpenAPIDocument"]>;

const API_VERSION = "v1";

/** Builds the served OpenAPI document (and the committed `swagger/openapi.json` the typed client is generated from) by merging every handler's routes. */
@singleton()
export class OpenApiDocsService {
  readonly #serverOrigin: string | undefined;

  constructor(@inject(APP_CONFIG) config: EnvConfig) {
    this.#serverOrigin = config.SERVER_ORIGIN;
  }

  generate(handlers: OpenApiHonoHandler[]): OpenApiDocument {
    const document: OpenApiDocument = {
      openapi: "3.0.0",
      info: {
        title: "Akash Chain Indexer API",
        description: "Read-only access to the chain data the Akash chain indexer derives from akashnet-2 and its test networks.",
        version: API_VERSION
      },
      servers: this.#serverOrigin ? [{ url: this.#serverOrigin }] : [],
      paths: {}
    };

    for (const handler of handlers) {
      const handlerDocument = handler.getOpenAPIDocument({ openapi: "3.0.0", info: { title: document.info.title, version: API_VERSION } });
      Object.assign(document.paths, handlerDocument.paths);
    }

    return document;
  }
}
