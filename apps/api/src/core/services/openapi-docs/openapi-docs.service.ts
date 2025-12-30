import { LoggerService } from "@akashnetwork/logging";
import axios from "axios";
import type { ComponentsObject, OpenAPIObject, PathsObject, ReferenceObject } from "openapi3-ts/oas30";
import { inject, singleton } from "tsyringe";

import { CORE_CONFIG, CoreConfig } from "@src/core/providers/config.provider";
import type { NotificationsConfig } from "@src/notifications/config/env.config";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import type { OpenApiHonoHandler } from "../open-api-hono-handler/open-api-hono-handler";

const logger = LoggerService.forContext("OpenApiDocsService");

@singleton()
export class OpenApiDocsService {
  readonly #serverOrigin: string;
  #externalSpecLoadPromise: Promise<OpenAPIObject | null> | null = null;

  constructor(
    @inject(CORE_CONFIG) coreConfig: CoreConfig,
    @inject(NOTIFICATIONS_CONFIG) private readonly notificationsConfig: NotificationsConfig | null = null
  ) {
    this.#serverOrigin = coreConfig.SERVER_ORIGIN;
  }

  async generateDocs(handlers: OpenApiHonoHandler[], options: { scope: string }) {
    const version = "v1";
    const docs = {
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

        if (handlerDocs.components?.schemas) {
          Object.assign(docs.components.schemas, handlerDocs.components.schemas);
        }

        if (handlerDocs.components?.securitySchemes) {
          Object.assign(docs.components.securitySchemes, handlerDocs.components.securitySchemes);
        }
      } catch (error) {
        logger.error({
          name: `Error generating OpenAPI docs for handler, example path: ${handler.routes[0]?.path || "unknown"}`,
          error
        });
      }
    }

    if (options.scope === "full") {
      const externalDocs = await this.#loadExternalNotificationsSpec();
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

  async #loadExternalNotificationsSpec(): Promise<OpenAPIObject | null> {
    if (!this.notificationsConfig) {
      return null;
    }

    if (this.#externalSpecLoadPromise) {
      return this.#externalSpecLoadPromise;
    }

    const externalOpenApiUrl = `${this.notificationsConfig.NOTIFICATIONS_API_BASE_URL}/api-json`;

    this.#externalSpecLoadPromise = (async () => {
      try {
        const response = await axios.get(externalOpenApiUrl, { timeout: 5000 });
        return response.data;
      } catch (error) {
        logger.warn({ event: "EXTERNAL_OPENAPI_FETCH_ERROR", error, url: externalOpenApiUrl });
        return null;
      }
    })();

    return this.#externalSpecLoadPromise;
  }

  /**
   * Filters out private/internal routes and their schemas from external OpenAPI spec.
   * Excludes routes with the "Jobs" tag or paths matching /v1/jobs/*
   */
  #filterPrivateRoutes(paths: PathsObject): { filteredPaths: PathsObject; usedSchemaRefs: Set<string> } {
    const excludedPathPrefixes = ["/v1/jobs"];
    const excludedTags = ["Jobs"];

    const filteredPaths: PathsObject = {};
    const usedSchemaRefs = new Set<string>();
    const httpMethods = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);

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
      if (excludedPathPrefixes.some(prefix => path.startsWith(prefix))) {
        continue;
      }

      const filteredPathItem: PathsObject[string] = {} as PathsObject[string];
      let hasOperations = false;

      for (const [key, value] of Object.entries(pathItem)) {
        const lowerKey = key.toLowerCase();

        if (!httpMethods.has(lowerKey)) {
          (filteredPathItem as Record<string, unknown>)[key] = value;
          extractSchemaRefs(value);
          continue;
        }

        const operation = value as { tags?: string[] };
        if (operation?.tags && operation.tags.some(tag => excludedTags.includes(tag))) {
          continue;
        }

        (filteredPathItem as Record<string, unknown>)[key] = value;
        extractSchemaRefs(value);
        hasOperations = true;
      }

      if (hasOperations) {
        filteredPaths[path] = filteredPathItem;
      }
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
