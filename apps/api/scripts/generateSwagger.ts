import "reflect-metadata";
import "@akashnetwork/env-loader";
import "../src/app";

import * as fsp from "fs/promises";
import { dirname, resolve } from "path";
import { container } from "tsyringe";

import { openApiHonoHandlers } from "../src/app/rest-handlers";
import { OpenApiDocsService } from "../src/core/services/openapi-docs/openapi-docs.service";

async function main() {
  const outputPathArg = process.argv[2];
  const defaultOutputPath = resolve(process.cwd(), "swagger/swagger.json");
  const outputPath = outputPathArg ? resolve(process.cwd(), outputPathArg) : defaultOutputPath;
  const scope = (process.argv[3] as "full" | "console") || "full";

  if (!["full", "console"].includes(scope)) {
    console.error(`Invalid scope: ${scope}. Valid options: "full", "console"`);
    process.exit(1);
  }

  console.log(`Generating OpenAPI docs with scope: ${scope}`);
  console.log(`Output path: ${outputPath}`);

  try {
    const openApiDocsService = container.resolve<OpenApiDocsService>(OpenApiDocsService);
    const docs = await openApiDocsService.generateDocs(openApiHonoHandlers, { scope });

    // Sanitize path parameter names - remove '?' from optional path parameters
    // Hono supports {param?} but OpenAPI doesn't, and it causes invalid TypeScript identifiers
    const sanitizedDocs = {
      ...docs,
      paths: Object.fromEntries(Object.entries(docs.paths || {}).map(([path, pathItem]) => [path.replace(/\{(\w+)\?}/g, "{$1}"), pathItem]))
    };

    const outputDir = dirname(outputPath);
    await fsp.mkdir(outputDir, { recursive: true });
    await fsp.writeFile(outputPath, JSON.stringify(sanitizedDocs, null, 2));

    console.log(`✓ Swagger JSON written successfully to ${outputPath}`);
  } catch (error) {
    console.error("Error generating Swagger docs:", error);
    process.exit(1);
  }
}

main();
