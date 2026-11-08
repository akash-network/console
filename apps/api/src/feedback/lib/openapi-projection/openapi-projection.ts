import type { ReferenceObject, SchemaObject } from "openapi3-ts/oas30";

type Schema = SchemaObject | ReferenceObject;
type Schemas = Record<string, Schema>;
type Properties = Record<string, Schema>;

const SCHEMA_REF_PREFIX = "#/components/schemas/";
const MAX_DEPTH = 32;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolvedSchemaOf(schema: Schema, schemas: Schemas, depth: number): SchemaObject | null {
  if (!("$ref" in schema)) return schema;
  if (depth > MAX_DEPTH || !schema.$ref.startsWith(SCHEMA_REF_PREFIX)) return null;

  const target = schemas[schema.$ref.slice(SCHEMA_REF_PREFIX.length)];
  return target ? resolvedSchemaOf(target, schemas, depth + 1) : null;
}

function mergedPropertiesOf(merged: Properties = {}, branch: Properties = {}): Properties {
  return Object.fromEntries(
    Object.entries({ ...branch, ...merged }).map(([name, schema]) => [
      name,
      Object.hasOwn(merged, name) && Object.hasOwn(branch, name) ? { anyOf: [merged[name], branch[name]] } : schema
    ])
  );
}

/** Folds allOf, anyOf and oneOf into one schema that admits every property any branch declares. */
function mergedSchemaOf(schema: SchemaObject, schemas: Schemas, depth: number): SchemaObject {
  const branches = [...(schema.allOf ?? []), ...(schema.anyOf ?? []), ...(schema.oneOf ?? [])]
    .map(branch => resolvedSchemaOf(branch, schemas, depth))
    .filter((branch): branch is SchemaObject => branch !== null)
    .map(branch => mergedSchemaOf(branch, schemas, depth + 1));

  return branches.reduce<SchemaObject>(
    (merged, branch) => ({
      ...merged,
      properties: mergedPropertiesOf(merged.properties, branch.properties),
      items: merged.items ?? branch.items,
      additionalProperties: merged.additionalProperties ?? branch.additionalProperties
    }),
    schema
  );
}

function isFreeForm(schema: SchemaObject): boolean {
  return !schema.properties && schema.additionalProperties === undefined;
}

/** Keeps only what a route's published response schema declares, since a handler can answer with columns its schema never published. */
export function projectedToSchema(value: unknown, schema: Schema | undefined, schemas: Schemas = {}, depth = 0): unknown {
  if (!schema) return value;

  const resolved = resolvedSchemaOf(schema, schemas, depth);
  if (!resolved || depth > MAX_DEPTH) return null;

  const merged = mergedSchemaOf(resolved, schemas, depth);

  if (Array.isArray(value)) return merged.items ? value.map(item => projectedToSchema(item, merged.items, schemas, depth + 1)) : value;
  if (!isRecord(value) || isFreeForm(merged)) return value;

  const { properties = {}, additionalProperties } = merged;

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      if (Object.hasOwn(properties, key)) return [[key, projectedToSchema(entry, properties[key], schemas, depth + 1)]];
      if (additionalProperties === true) return [[key, entry]];
      if (isRecord(additionalProperties)) return [[key, projectedToSchema(entry, additionalProperties, schemas, depth + 1)]];

      return [];
    })
  );
}
