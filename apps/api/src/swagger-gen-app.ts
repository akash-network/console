import { createOtelLogger } from "@akashnetwork/logging/otel";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { container } from "tsyringe";

import { OpenApiDocsService } from "./core/services/openapi-docs/openapi-docs.service";
import { openApiHonoHandlers } from "./routers/open-api-handlers";

const OUT = resolve(process.env.OPENAPI_OUT_PATH ?? "swagger/openapi.json");
const logger = createOtelLogger({ context: "SwaggerGen" });

export async function bootstrap() {
  try {
    const service = container.resolve(OpenApiDocsService);
    const docs = await service.generateDocs(openApiHonoHandlers, { scope: "full", source: "file" });

    logger.info({ event: "OPENAPI_SPEC_WRITING", path: OUT });
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify(docs, null, 2), "utf8");
    logger.info({ event: "OPENAPI_SPEC_WRITTEN", path: OUT });

    process.exit(0);
  } catch (error) {
    logger.error({ event: "OPENAPI_SPEC_WRITE_FAILED", error });
    process.exit(1);
  }
}
