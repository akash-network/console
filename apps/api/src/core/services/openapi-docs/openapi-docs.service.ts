import { createOtelLogger } from "@akashnetwork/logging/otel";
import axios from "axios";
import { readFile } from "node:fs/promises";
import type { ComponentsObject, OpenAPIObject, PathsObject, ReferenceObject } from "openapi3-ts/oas30";
import { inject, singleton } from "tsyringe";

import type { CoreConfig } from "@src/core/providers/config.provider";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import type { NotificationsConfig } from "@src/notifications/config/env.config";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import type { OpenApiHonoHandler } from "../open-api-hono-handler/open-api-hono-handler";

const logger = createOtelLogger({ context: "OpenApiDocsService" });

@singleton()
export class OpenApiDocsService {
  readonly #serverOrigin: string;
  #externalSpecLoadPromises: Partial<Record<"file" | "http", Promise<OpenAPIObject | null>>> = {};

  constructor(
    @inject(CORE_CONFIG) coreConfig: CoreConfig,
    @inject(NOTIFICATIONS_CONFIG) private readonly notificationsConfig: NotificationsConfig | null = null
  ) {
    this.#serverOrigin = coreConfig.SERVER_ORIGIN;
  }

  async generateDocs(handlers: OpenApiHonoHandler[], options: { scope: string; source?: "file" | "http" }): Promise<OpenAPIObject> {
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

        Object.assign(docs.paths, handlerDocs.paths);
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
        const { filteredPaths, usedSchemaRefs } = this.#filterPrivateRoutes(externalDocs.paths);
        Object.assign(docs.paths, filteredPaths);

        if (externalDocs?.components?.schemas) {
          const filteredSchemas = this.#filterSchemasByReferences(externalDocs.components.schemas, usedSchemaRefs);

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
  }

  async #loadExternalNotificationsSpec(source: "file" | "http"): Promise<OpenAPIObject | null> {
    if (!this.notificationsConfig) return null;

    const cached = this.#externalSpecLoadPromises[source];
    if (cached) return cached;

    const promise = source === "file" ? this.#loadNotificationsSpecFromFile() : this.#loadNotificationsSpecFromHttp();
    this.#externalSpecLoadPromises[source] = promise;
    return promise;
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
      const response = await axios.get(externalOpenApiUrl, { timeout: 5000 });
      return response.data;
    } catch (error) {
      logger.warn({ event: "EXTERNAL_OPENAPI_FETCH_ERROR", error, url: externalOpenApiUrl });
      return null;
    }
  }

  /**
   * Filters out internal routes and their schemas from the external OpenAPI spec.
   * Internal endpoints live under /internal/ and ship in apps/notifications/swagger.internal.json;
   * the public swagger.json should already exclude them, but we belt-and-suspender here.
   */
  #filterPrivateRoutes(paths: PathsObject): { filteredPaths: PathsObject; usedSchemaRefs: Set<string> } {
    const filteredPaths: PathsObject = {};
    const usedSchemaRefs = new Set<string>();

    const extractSchemaRefs = (obj: unknown): void => {
      if (!obj || typeof obj !== "object") {
        return;
      }

      if (Array.isArray(obj)) {
        obj.forEach(item => extractSchemaRefs(item));
        return;
      }

      const objWithRef = obj as ReferenceObject | { $ref?: string };
      if (objWithRef.$ref && typeof objWithRef.$ref === "string" && objWithRef.$ref.startsWith("#/components/schemas/")) {
        const schemaName = objWithRef.$ref.replace("#/components/schemas/", "");
        usedSchemaRefs.add(schemaName);
      }

      Object.values(obj).forEach(value => extractSchemaRefs(value));
    };

    for (const [path, pathItem] of Object.entries(paths)) {
      if (path.startsWith("/internal/")) {
        continue;
      }
      filteredPaths[path] = pathItem;
      extractSchemaRefs(pathItem);
    }

    return { filteredPaths, usedSchemaRefs };
  }

  /**
   * Filters schemas to only include those referenced by the provided schema references set.
   * Also extracts nested schema references (if SchemaA references SchemaB, includes SchemaB).
   *
   * @param schemas - All available schemas from external OpenAPI spec
   * @param usedSchemaRefs - Set of schema names that are referenced by filtered routes
   * @returns Filtered schemas object containing only referenced schemas
   */
  #filterSchemasByReferences(schemas: ComponentsObject["schemas"], usedSchemaRefs: Set<string>): ComponentsObject["schemas"] {
    if (!schemas) {
      return {};
    }

    const visitedSchemas = new Set<string>();
    const extractNestedSchemaRefs = (obj: unknown): void => {
      if (!obj || typeof obj !== "object") {
        return;
      }

      if (Array.isArray(obj)) {
        obj.forEach(item => extractNestedSchemaRefs(item));
        return;
      }

      const objWithRef = obj as ReferenceObject | { $ref?: string };
      if (objWithRef.$ref && typeof objWithRef.$ref === "string" && objWithRef.$ref.startsWith("#/components/schemas/")) {
        const schemaName = objWithRef.$ref.replace("#/components/schemas/", "");
        if (!visitedSchemas.has(schemaName) && schemas[schemaName]) {
          visitedSchemas.add(schemaName);
          usedSchemaRefs.add(schemaName);
          extractNestedSchemaRefs(schemas[schemaName]);
        }
      }

      Object.values(obj).forEach(value => extractNestedSchemaRefs(value));
    };

    const initialRefs = Array.from(usedSchemaRefs);
    for (const schemaName of initialRefs) {
      if (!visitedSchemas.has(schemaName)) {
        visitedSchemas.add(schemaName);
        const schema = schemas?.[schemaName];
        if (schema) {
          extractNestedSchemaRefs(schema);
        }
      }
    }

    const filteredSchemas: ComponentsObject["schemas"] = {};
    for (const [schemaName, schema] of Object.entries(schemas)) {
      if (usedSchemaRefs.has(schemaName)) {
        filteredSchemas[schemaName] = schema;
      }
    }

    return filteredSchemas;
  }
}
