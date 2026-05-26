import type { OpenAPIObject } from "@nestjs/swagger";

export type SwaggerScope = "public" | "internal";

const INTERNAL_PATH_RE = /^\/internal(?:\/|$)/;

type Schemas = NonNullable<NonNullable<OpenAPIObject["components"]>["schemas"]>;

export function filterDocumentByScope(document: OpenAPIObject, scope: SwaggerScope): OpenAPIObject {
  const filteredPaths: OpenAPIObject["paths"] = {};
  for (const [pathKey, pathValue] of Object.entries(document.paths)) {
    const isInternal = INTERNAL_PATH_RE.test(pathKey);
    const include = scope === "internal" ? isInternal : !isInternal;
    if (include) {
      filteredPaths[pathKey] = pathValue;
    }
  }

  const allSchemas = document.components?.schemas ?? {};
  const referenced = collectReferencedSchemas(filteredPaths, allSchemas);
  const filteredSchemas: Schemas = {};
  for (const [name, schema] of Object.entries(allSchemas)) {
    if (referenced.has(name)) {
      filteredSchemas[name] = schema;
    }
  }

  return {
    ...document,
    paths: filteredPaths,
    components: { ...document.components, schemas: filteredSchemas }
  };
}

function collectReferencedSchemas(paths: OpenAPIObject["paths"], schemas: Schemas): Set<string> {
  const referenced = new Set<string>();
  const queue: string[] = [];

  const enqueueRefsFrom = (value: unknown) => {
    const json = JSON.stringify(value);
    if (!json) return;
    for (const match of json.matchAll(/"\$ref":\s*"#\/components\/schemas\/([^"]+)"/g)) {
      const name = match[1];
      if (!referenced.has(name)) {
        referenced.add(name);
        queue.push(name);
      }
    }
  };

  enqueueRefsFrom(paths);
  while (queue.length > 0) {
    const name = queue.shift() as string;
    if (schemas[name]) {
      enqueueRefsFrom(schemas[name]);
    }
  }

  return referenced;
}
