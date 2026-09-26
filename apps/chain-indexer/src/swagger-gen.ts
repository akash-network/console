import "reflect-metadata";
import "@src/providers";

import { mkdirSync, writeFileSync } from "node:fs";
import { container } from "tsyringe";

import { apiHandlers } from "@src/routes";
import { OpenApiDocsService } from "@src/services/openapi-docs/openapi-docs.service";

const OUTPUT_DIR = "swagger";

/** Writes the OpenAPI document the typed client is generated from (`npm run swagger:gen`); it needs no database or network. */
function main(): void {
  const document = container.resolve(OpenApiDocsService).generate(apiHandlers);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(`${OUTPUT_DIR}/openapi.json`, `${JSON.stringify(document, null, 2)}\n`);
}

main();
