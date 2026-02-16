import { faker } from "@faker-js/faker";
import { Body, Controller, INestApplication, Module, Post, Query } from "@nestjs/common";
import { APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import { createZodDto, ZodSerializerInterceptor } from "nestjs-zod";
import request from "supertest";
import { Ok } from "ts-results";
import { describe, expect, it } from "vitest";
import { MockProxy } from "vitest-mock-extended";
import { z } from "zod";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { ValidateHttp } from "@src/interfaces/rest/decorators/http-validate/http-validate.decorator";
import { HttpExceptionFilter } from "@src/interfaces/rest/filters/http-exception/http-exception.filter";
import { HttpResultInterceptor } from "@src/interfaces/rest/interceptors/http-result/http-result.interceptor";

import { MockProvider } from "@test/mocks/provider.mock";

describe("HTTP Tools", () => {
  describe("functional validation", () => {
    it("should succeed with valid request and response", async () => {
      const { app } = await setup();

      const { foo, bar } = generateValidInput();

      const res = await request(app.getHttpServer()).post("/test/validate").query({ bar }).send({ foo });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ baz: 123 });
    });

    it("should fail with invalid body", async () => {
      const { app } = await setup();

      const res = await request(app.getHttpServer()).post("/test/validate").query({ bar: faker.lorem.word() }).send({ bar: 123 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation failed");
    });

    it("should fail with invalid query", async () => {
      const { app } = await setup();

      const res = await request(app.getHttpServer()).post("/test/validate").query({ bar: "f" }).send({ foo: faker.lorem.word() });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Validation failed");
    });

    it("should return 500 on invalid response schema", async () => {
      const { app, logger } = await setup();

      const { foo, bar } = generateValidInput();

      const res = await request(app.getHttpServer()).post("/test/bad-response").query({ bar }).send({ foo });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Internal Server Error");
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "HTTP_RESPONSE_VALIDATION_FAILED" }));
    });
  });

  async function setup(): Promise<{
    app: INestApplication;
    logger: MockProxy<LoggerService>;
  }> {
    class BodyDto extends createZodDto(z.object({ foo: z.string() })) {}
    class QueryDto extends createZodDto(z.object({ bar: z.string().min(3) })) {}
    class ResponseDto extends createZodDto(z.object({ baz: z.number() })) {}

    @Controller("test")
    class TestController {
      @Post("validate")
      @ValidateHttp({
        201: {
          schema: ResponseDto
        }
      })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      validate(@Query() query: QueryDto, @Body() body: BodyDto) {
        return Ok({ baz: 123 });
      }

      @Post("bad-response")
      @ValidateHttp({
        201: {
          schema: ResponseDto
        }
      })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      badResponse(@Query() query: QueryDto, @Body() body: BodyDto) {
        return Ok({ baz: "wrong" });
      }
    }

    @Module({
      controllers: [TestController],
      providers: [Reflector, MockProvider(LoggerService), { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor }]
    })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule]
    }).compile();

    const app = module.createNestApplication();
    const logger = app.get<MockProxy<LoggerService>>(LoggerService);

    app.useGlobalInterceptors(new HttpResultInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter(logger));

    await app.init();

    return { app, logger };
  }

  function generateValidInput() {
    return {
      foo: faker.lorem.word(),
      bar: faker.lorem.word()
    };
  }
});
