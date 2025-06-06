import "@akashnetwork/env-loader";

import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder } from "@nestjs/swagger";
import { SwaggerModule } from "@nestjs/swagger";
import fs from "fs";
import { patchNestJsSwagger } from "nestjs-zod";
import path from "path";

import { Logger } from "@src/common/providers/logger.provider";

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
    private readonly swaggerModule: typeof SwaggerModule = SwaggerModule,
    private readonly fsModule: typeof fs = fs,
    private readonly pathModule: typeof path = path
  ) {}

  serveSwagger() {
    const documentFactory = this.createSwaggerDocument();

    this.swaggerModule.setup("api", this.app, documentFactory, {
      customSwaggerUiPath: this.pathModule.resolve(__dirname, "../dist/swagger-ui-dist")
    });
  }

  generateSwagger() {
    const logger = new Logger({ context: "SWAGGER" });

    const swaggerDir = this.pathModule.resolve(__dirname, "../swagger");

    if (!this.fsModule.existsSync(swaggerDir)) {
      this.fsModule.mkdirSync(swaggerDir);
    }

    const file = this.pathModule.join(swaggerDir, "swagger.json");

    const document = this.createSwaggerDocument()();
    this.fsModule.writeFileSync(file, JSON.stringify(document, null, 2));

    logger.info(`"${file}" created successfully. Exiting`);

    process.exit(0);
  }

  private createSwaggerDocument() {
    this.patchSwagger();

    const config = new this.documentBuilder()
      .setTitle("NotificationsAPI")
      .setDescription("Notifications API")
      .setVersion("1.0")
      .addTag("ContactPoint")
      .addTag("Alert")
      .addTag("DeploymentAlert")
      .addApiKey(
        {
          type: "apiKey",
          name: "x-user-id",
          in: "header"
        },
        "x-user-id"
      )
      .addSecurityRequirements({ "x-user-id": [] })
      .build();

    return () =>
      this.swaggerModule.createDocument(this.app, config, {
        operationIdFactory: (_, methodKey) => methodKey
      });
  }
}
