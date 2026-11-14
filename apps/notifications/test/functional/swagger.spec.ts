import { Body, Controller, type INestApplication, Module, Post } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createZodDto } from "nestjs-zod";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { SwaggerSetup } from "@src/lib/bootstrap/swagger-setup/swagger-setup";

describe("Swagger", () => {
  it("serves the public document with schemas generated from zod DTOs", async () => {
    const { app } = await setup();

    const res = await request(app.getHttpServer()).get("/api-json");

    expect(res.status).toBe(200);
    expect(res.body.components.schemas.WidgetDto).toMatchObject({
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"]
    });
  });

  async function setup() {
    class WidgetDto extends createZodDto(z.object({ name: z.string() })) {}

    @Controller("v1/widgets")
    class WidgetController {
      @Post()
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      create(@Body() body: WidgetDto) {
        return {};
      }
    }

    @Module({ controllers: [WidgetController] })
    class WidgetModule {}

    const module = await Test.createTestingModule({ imports: [WidgetModule] }).compile();
    const app: INestApplication = module.createNestApplication();

    SwaggerSetup.serveSwagger(app);
    await app.init();

    return { app };
  }
});
