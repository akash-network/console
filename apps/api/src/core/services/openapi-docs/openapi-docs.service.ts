import { createOtelLogger } from "@akashnetwork/logging/otel";
import { readFile } from "node:fs/promises";
import type { ComponentsObject, OpenAPIObject, PathItemObject, PathsObject, ReferenceObject } from "openapi3-ts/oas30";
import { inject, singleton } from "tsyringe";

import { memoizeAsync } from "@src/caching/helpers";
import { HIDDEN_ROUTES } from "@src/core/lib/create-route/create-route";
import type { CoreConfig } from "@src/core/providers/config.provider";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import type { NotificationsConfig } from "@src/notifications/config/env.config";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import type { OpenApiHonoHandler } from "../open-api-hono-handler/open-api-hono-handler";

const logger = createOtelLogger({ context: "OpenApiDocsService" });

@singleton()
export class OpenApiDocsService {
  readonly #serverOrigin: string;

  constructor(
    @inject(CORE_CONFIG) coreConfig: CoreConfig,
    @inject(NOTIFICATIONS_CONFIG) private readonly notificationsConfig: NotificationsConfig | null = null
  ) {
    this.#serverOrigin = coreConfig.SERVER_ORIGIN;
  }

  generateDocs = memoizeAsync(
    async (handlers: OpenApiHonoHandler[], options: { scope: string; source?: "file" | "http" }): Promise<OpenAPIObject> => {
      const source = options.source ?? "http";
      const version = "v1";
      const docs: OpenAPIObject & { components: NonNullable<OpenAPIObject["components"]> } = {
        openapi: "3.0.0",
        servers: [{ url: this.#serverOrigin }],
        info: {
          title: "Akash Network Console API",
          description: "API providing data to the Akash Network Console",
          version: version
        },
        paths: {},
        components: {
          schemas: {},
          securitySchemes: {
            BearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description: 'JWT token for authenticated users, sent in "Authorization: Bearer %token" header.'
            },
            ApiKeyAuth: {
              type: "apiKey",
              in: "header",
              name: "x-api-key",
              description: "API key for programmatic access."
            }
          }
        }
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

          Object.assign(docs.paths, this.#stripHiddenOperations(handlerDocs.paths));
        } catch (error) {
          logger.error({
            name: `Error generating OpenAPI docs for handler, example path: ${handler.routes[0]?.path || "unknown"}`,
            error
          });
        }
      }

      if (options.scope === "full") {
        const externalDocs = await this.#loadExternalNotificationsSpec(source);
        if (externalDocs?.paths) {
          const filteredPaths = this.#filterPrivateRoutes(externalDocs.paths);
          Object.assign(docs.paths, filteredPaths);

          if (externalDocs?.components?.schemas) {
            const filteredSchemas = this.#filterSchemasByReferences(externalDocs.components.schemas, filteredPaths);

            docs.components.schemas = {
              ...docs.components.schemas,
              ...filteredSchemas
            };
            docs.components.securitySchemes = {
              ...docs.components.securitySchemes,
              ...(externalDocs.components.securitySchemes || {})
            };
          } else if (externalDocs?.components) {
            docs.components.securitySchemes = {
              ...docs.components.securitySchemes,
              ...(externalDocs.components.securitySchemes || {})
            };
          }
        }
      }

      return docs;
    },
    {
      ttl: 60 * 60 * 1000, // 1 hour
      cacheItemLimit: 10,
      getCacheKey: (_, options) => `${options.scope}-${options.source ?? "http"}`
    }
  );

  async #loadExternalNotificationsSpec(source: "file" | "http"): Promise<OpenAPIObject | null> {
    if (!this.notificationsConfig) return null;

    const promise = source === "file" ? this.#loadNotificationsSpecFromFile() : this.#loadNotificationsSpecFromHttp();
    return await promise;
  }

  async #loadNotificationsSpecFromFile(): Promise<OpenAPIObject | null> {
    const filePath = this.notificationsConfig?.NOTIFICATIONS_SWAGGER_PATH;
    if (!filePath) return null;
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as OpenAPIObject;
    } catch (error) {
      logger.warn({ event: "EXTERNAL_OPENAPI_FILE_READ_ERROR", error, path: filePath });
      return null;
    }
  }

  async #loadNotificationsSpecFromHttp(): Promise<OpenAPIObject | null> {
    const externalOpenApiUrl = `${this.notificationsConfig!.NOTIFICATIONS_API_BASE_URL}/api-json`;
    try {
      const response = await fetch(externalOpenApiUrl, { signal: AbortSignal.timeout(5000) });
      return (await response.json()) as OpenAPIObject;
    } catch (error) {
      logger.warn({ event: "EXTERNAL_OPENAPI_FETCH_ERROR", error, url: externalOpenApiUrl });
      return null;
    }
  }

  /**
   * Removes operations marked with the `OPENAPI_HIDDEN_EXTENSION` vendor extension from a paths
   * object. Routes opt in via `createRoute({ hiddenInOpenApiDocs: true, ... })` — e.g. webhook
   * endpoints whose path is a shared secret and must not appear in public docs.
   */
  #stripHiddenOperations(paths: PathsObject | undefined): PathsObject {
    if (!paths) return {};
    const result: PathsObject = {};

    for (const [path, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== "object") continue;

      let filteredItem: PathItemObject | null = null;
      Object.keys(pathItem).forEach(key => {
        const route = pathItem[key as keyof PathItemObject];
        if (typeof route !== "object" || route === null) return;

        const operationId = route.operationId ?? `${key.toUpperCase()} ${path}`;
        if (!HIDDEN_ROUTES.has(operationId)) {
          filteredItem ??= {};
          filteredItem[key as keyof PathItemObject] = pathItem[key as keyof PathItemObject];
        }
      });
      if (filteredItem) {
        result[path] = filteredItem;
      }
    }
    return result;
  }

  /**
   * Filters out internal routes and their schemas from the external OpenAPI spec.
   * Internal endpoints live under /internal/ and ship in apps/notifications/swagger.internal.json;
   * the public swagger.json should already exclude them, but we belt-and-suspender here.
   */
  #filterPrivateRoutes(paths: PathsObject): PathsObject {
    const filteredPaths: PathsObject = {};

    for (const [path, pathItem] of Object.entries(paths)) {
      if (path.startsWith("/internal/")) {
        continue;
      }
      filteredPaths[path] = pathItem;
    }

    return filteredPaths;
  }

  /**
   * Filters schemas to only those transitively referenced from `seed`. The seed can be any object
   * containing `$ref: "#/components/schemas/..."` entries (e.g. a paths object). Walks each
   * referenced schema's body to pull in nested refs (if SchemaA references SchemaB, includes
   * SchemaB).
   *
   * @param schemas - All available schemas from external OpenAPI spec
   * @param seed - Object to scan for the initial set of `$ref`s (typically the filtered paths)
   * @returns Filtered schemas object containing only referenced schemas
   */
  #filterSchemasByReferences(schemas: ComponentsObject["schemas"], seed: unknown): ComponentsObject["schemas"] {
    if (!schemas) {
      return {};
    }

    const usedSchemaRefs = new Set<string>();
    const walk = (obj: unknown): void => {
      if (!obj || typeof obj !== "object") {
        return;
      }

      if (Array.isArray(obj)) {
        obj.forEach(walk);
        return;
      }

      const objWithRef = obj as ReferenceObject | { $ref?: string };
      if (objWithRef.$ref && typeof objWithRef.$ref === "string" && objWithRef.$ref.startsWith("#/components/schemas/")) {
        const schemaName = objWithRef.$ref.replace("#/components/schemas/", "");
        if (!usedSchemaRefs.has(schemaName) && schemas[schemaName]) {
          usedSchemaRefs.add(schemaName);
          walk(schemas[schemaName]);
        }
      }

      Object.values(obj).forEach(walk);
    };

    walk(seed);

    const filteredSchemas: ComponentsObject["schemas"] = {};
    for (const [schemaName, schema] of Object.entries(schemas)) {
      if (usedSchemaRefs.has(schemaName)) {
        filteredSchemas[schemaName] = schema;
      }
    }

    return filteredSchemas;
  }
}
