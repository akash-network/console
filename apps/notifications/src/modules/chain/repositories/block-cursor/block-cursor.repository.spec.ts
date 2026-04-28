import { faker } from "@faker-js/faker";
import { ConfigModule } from "@nestjs/config";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { DRIZZLE_PROVIDER_TOKEN } from "@src/infrastructure/db/config/db.config";
import { register } from "@src/infrastructure/db/db.module";
import * as schema from "@src/modules/chain/model-schemas";
import { BlockCursorRepository } from "./block-cursor.repository";

import { TestDatabaseService } from "@test/services/test-database.service";

describe(BlockCursorRepository.name, () => {
  const testDbService = new TestDatabaseService(expect.getState().testPath!);

  beforeAll(async () => {
    await testDbService.setup();
  });

  afterAll(async () => {
    await testDbService.teardown();
  });

  describe("setBlockHeight", () => {
    it("inserts the cursor row when none exists", async () => {
      const { repository, db } = await setup();
      const height = faker.number.int({ min: 1000, max: 9999999 });

      await repository.setBlockHeight(height);

      const rows = await db.select().from(schema.BlockCursor).where(eq(schema.BlockCursor.id, "latest"));
      expect(rows).toHaveLength(1);
      expect(rows[0].lastProcessedBlock).toBe(height);
    });

    it("overwrites the existing cursor unconditionally", async () => {
      const { repository, db } = await setup();
      const initialHeight = faker.number.int({ min: 1000, max: 5000000 });
      const newHeight = faker.number.int({ min: 5000001, max: 9999999 });

      await repository.ensureInitialized(initialHeight);
      await repository.setBlockHeight(newHeight);

      const rows = await db.select().from(schema.BlockCursor).where(eq(schema.BlockCursor.id, "latest"));
      expect(rows).toHaveLength(1);
      expect(rows[0].lastProcessedBlock).toBe(newHeight);
    });
  });

  let testModule: TestingModule | undefined;
  afterEach(async () => {
    await testModule?.get(DRIZZLE_PROVIDER_TOKEN).session.client.end();
    await testModule?.close();
  });

  async function setup() {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), ...register(schema)],
      providers: [BlockCursorRepository]
    }).compile();
    testModule = module;

    const repository = module.get(BlockCursorRepository);
    const db = module.get<NodePgDatabase<typeof schema>>(DRIZZLE_PROVIDER_TOKEN);

    return { repository, db };
  }
});
