import { generateMock } from '@anatine/zod-mock';
import { faker } from '@faker-js/faker';
import { INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import request from 'supertest';

import { DRIZZLE_PROVIDER_TOKEN } from '@src/config/db.config';
import { alertCreateInputSchema } from '@src/interfaces/rest/controllers/alert/alert.controller';
import { HttpExceptionFilter } from '@src/interfaces/rest/filters/http-exception/http-exception.filter';
import { HttpResultInterceptor } from '@src/interfaces/rest/interceptors/http-result/http-result.interceptor';
import RestModule from '@src/interfaces/rest/rest.module';
import * as schema from '@src/modules/alert/model-schemas';

import { generateContactPoint } from '@test/seeders/contact-point.seeder';

describe('Alerts CRUD', () => {
  it('should create alert with valid input', async () => {
    const { app, module } = await setup();

    const userId = faker.string.uuid();
    const db = module.get<NodePgDatabase<typeof schema>>(
      DRIZZLE_PROVIDER_TOKEN,
    );
    const [contactPoint] = await db
      .insert(schema.ContactPoint)
      .values([generateContactPoint({ userId })])
      .returning();
    const input = generateMock(alertCreateInputSchema);
    input.userId = userId;
    input.contactPointId = contactPoint.id;

    const res = await request(app.getHttpServer())
      .post('/v1/alerts/raw')
      .send({ data: input });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      ...input,
      id: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    await app.close();
  });

  async function setup(): Promise<{
    app: INestApplication;
    module: TestingModule;
  }> {
    @Module({
      imports: [RestModule],
    })
    class TestModule {}

    const module: TestingModule = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();

    const app = module.createNestApplication();
    app.enableVersioning();
    app.useGlobalInterceptors(new HttpResultInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();

    return { app, module };
  }
});
