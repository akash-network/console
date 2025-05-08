import { faker } from '@faker-js/faker';
import { Controller, INestApplication, Module, Post } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { MockProxy } from 'jest-mock-extended';
import request from 'supertest';
import { Ok } from 'ts-results';
import { z } from 'zod';

import { LoggerService } from '@src/common/services/logger/logger.service';
import { HttpExceptionFilter } from '@src/interfaces/rest/filters/http-exception/http-exception.filter';
import { HttpResultInterceptor } from '@src/interfaces/rest/interceptors/http-result/http-result.interceptor';
import {
  HttpValidateInterceptor,
  ValidateHttp,
} from '@src/interfaces/rest/interceptors/http-validate/http-validate.interceptor';

import { MockProvider } from '@test/mocks/provider.mock';

describe('HTTP Tools', () => {
  describe('functional validation', () => {
    it('should succeed with valid request and response', async () => {
      const { app } = await setup();

      const { foo, bar } = generateValidInput();

      const res = await request(app.getHttpServer())
        .post('/test/validate')
        .query({ bar })
        .send({ foo });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ baz: 123 });
    });

    it('should fail with invalid body', async () => {
      const { app } = await setup();

      const res = await request(app.getHttpServer())
        .post('/test/validate')
        .query({ bar: faker.lorem.word() })
        .send({ bar: 123 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid body');
    });

    it('should fail with invalid query', async () => {
      const { app } = await setup();

      const res = await request(app.getHttpServer())
        .post('/test/validate')
        .query({ bar: 'f' })
        .send({ foo: faker.lorem.word() });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid query');
    });

    it('should return 500 on invalid response schema', async () => {
      const { app, logger } = await setup();

      const { foo, bar } = generateValidInput();

      const res = await request(app.getHttpServer())
        .post('/test/bad-response')
        .query({ bar })
        .send({ foo });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Internal Server Error');
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'HTTP_RESPONSE_VALIDATION_FAILED' }),
      );
    });
  });

  async function setup(): Promise<{
    app: INestApplication;
    logger: MockProxy<LoggerService>;
  }> {
    const bodySchema = z.object({ foo: z.string() });
    const querySchema = z.object({ bar: z.string().min(3) });
    const responseSchema = z.object({ baz: z.number() });

    @Controller('test')
    class TestController {
      @Post('validate')
      @ValidateHttp({
        body: bodySchema,
        query: querySchema,
        response: responseSchema,
      })
      validate() {
        return Ok({ baz: 123 });
      }

      @Post('bad-response')
      @ValidateHttp({
        body: bodySchema,
        query: querySchema,
        response: responseSchema,
      })
      badResponse() {
        return Ok({ baz: 'wrong' });
      }
    }

    @Module({
      controllers: [TestController],
      providers: [
        Reflector,
        HttpValidateInterceptor,
        MockProvider(LoggerService),
      ],
    })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    const app = module.createNestApplication();
    app.useGlobalInterceptors(new HttpResultInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    const logger = app.get<MockProxy<LoggerService>>(LoggerService);

    return { app, logger };
  }

  function generateValidInput() {
    return {
      foo: faker.lorem.word(),
      bar: faker.lorem.word(),
    };
  }
});
