import "@akashnetwork/env-loader";

import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder } from "@nestjs/swagger";
import { SwaggerModule } from "@nestjs/swagger";
import fs from "fs";
import { patchNestJsSwagger } from "nestjs-zod";
import path from "path";

import { Logger } from "@src/common/providers/logger.provider";
import { filterDocumentByScope, type SwaggerScope } from "./swagger-scope-filter";

const SCOPES: { scope: SwaggerScope; mountPath: string; fileName: string }[] = [
  { scope: "public", mountPath: "api", fileName: "swagger.json" },
  { scope: "internal", mountPath: "api/internal", fileName: "swagger.internal.json" }
];

export type SwaggerModuleAPI = Pick<typeof SwaggerModule, "setup" | "createDocument">;

export class SwaggerSetup {
  static serveSwagger(app: INestApplication): void {
    new SwaggerSetup(app).serveSwagger();
  }

  static generateSwagger(app: INestApplication): void {
    new SwaggerSetup(app).generateSwagger();
  }

  constructor(
    private readonly app: INestApplication,
    private readonly patchSwagger: typeof patchNestJsSwagger = patchNestJsSwagger,
    private readonly documentBuilder: typeof DocumentBuilder = DocumentBuilder,
    private readonly swaggerModule: SwaggerModuleAPI = SwaggerModule,
    private readonly fsModule: typeof fs = fs,
    private readonly pathModule: typeof path = path
  ) {}

  serveSwagger(): void {
    const customSwaggerUiPath = this.pathModule.resolve(__dirname, "../dist/swagger-ui-dist");

    for (const { scope, mountPath } of SCOPES) {
      const documentFactory = this.createSwaggerDocument(scope);
      this.swaggerModule.setup(mountPath, this.app, documentFactory, { customSwaggerUiPath });
    }
  }

  generateSwagger(): void {
    const logger = new Logger({ context: "SWAGGER" });
    const swaggerDir = this.pathModule.resolve(__dirname, "../swagger");

    if (!this.fsModule.existsSync(swaggerDir)) {
      this.fsModule.mkdirSync(swaggerDir);
    }

    for (const { scope, fileName } of SCOPES) {
      const file = this.pathModule.join(swaggerDir, fileName);
      const document = this.createSwaggerDocument(scope)();
      this.fsModule.writeFileSync(file, JSON.stringify(document, null, 2));
      logger.info(`"${file}" created successfully.`);
    }

    process.exit(0);
  }

  private createSwaggerDocument(scope: SwaggerScope) {
    this.patchSwagger();

    const builder = new this.documentBuilder()
      .setTitle(scope === "public" ? "NotificationsAPI" : "NotificationsAPI (Internal)")
      .setDescription(
        scope === "public"
          ? "Notifications API"
          : "Internal-only endpoints for server-to-server use within the private network. Not exposed to the public internet."
      )
      .setVersion("1.0");

    if (scope === "public") {
      builder
        .addTag("NotificationChannel")
        .addTag("Alert")
        .addTag("DeploymentAlert")
        .addApiKey({ type: "apiKey", name: "x-user-id", in: "header" }, "x-user-id")
        .addApiKey({ type: "apiKey", name: "x-owner-address", in: "header" }, "x-owner-address")
        .addSecurityRequirements({ "x-user-id": [], "x-owner-address": [] });
    }

    const config = builder.build();

    return () => {
      const document = this.swaggerModule.createDocument(this.app, config, {
        operationIdFactory: (_, methodKey) => methodKey
      });
      return filterDocumentByScope(document, scope);
    };
  }
}
