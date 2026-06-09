import type { ProviderAttributesSchema } from "@akashnetwork/http-sdk";
import { readFileSync } from "node:fs";
import path from "node:path";

let cachedSchema: ProviderAttributesSchema | undefined;

export function loadLocalProviderAttributesSchema(): ProviderAttributesSchema {
  cachedSchema ??= JSON.parse(readFileSync(path.join(__dirname, "../../../../config/provider-attributes.json"), "utf8")) as ProviderAttributesSchema;

  return cachedSchema;
}

export function createProviderAttributesSchema(): ProviderAttributesSchema {
  return loadLocalProviderAttributesSchema();
}
