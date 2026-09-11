import { DrizzleQueryError } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiPgDatabase } from "@src/core/providers";
import { BaseRepository } from "@src/core/repositories/base.repository";
import type { TxService } from "@src/core/services";
import { DataKeys } from "@src/secret/model-schemas";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import { Users } from "@src/user/model-schemas";
import { UserRepository } from "@src/user/repositories";

const DATA_KEY_ID = "6e4c9a2c-0f1d-4a3b-9c5e-7d8f0a1b2c3d";
const OTHER_DATA_KEY_ID = "f1a2b3c4-d5e6-4789-9abc-def012345678";
const USER_ID = "1b2c3d4e-5f60-4718-9a2b-3c4d5e6f7081";
const UNREACHABLE_DRIVER = "the driver is stubbed out in unit tests";

describe(BaseRepository.name, () => {
  describe("updateBy", () => {
    it("stamps updated_at on a table that declares the column", async () => {
      const { dataKeyRepository, executedQueries } = setup();

      await executeAgainstStubbedDriver(() => dataKeyRepository.updateBy({ userId: USER_ID }, { wrappedByKid: "kms-v2" }));

      expect(executedQueries).toEqual([
        {
          query: 'update "data_keys" set "wrapped_by_kid" = $1, "updated_at" = now() where "data_keys"."user_id" = $2',
          params: ["kms-v2", USER_ID]
        }
      ]);
    });

    it("keeps an updatedAt supplied by the caller", async () => {
      const { dataKeyRepository, executedQueries } = setup();
      const updatedAt = new Date("2026-03-04T05:06:07.000Z");

      await executeAgainstStubbedDriver(() => dataKeyRepository.updateBy({ id: DATA_KEY_ID }, { wrappedByKid: "kms-v2", updatedAt }));

      expect(executedQueries).toEqual([
        {
          query: 'update "data_keys" set "wrapped_by_kid" = $1, "updated_at" = $2 where "data_keys"."id" = $3',
          params: ["kms-v2", updatedAt.toISOString(), DATA_KEY_ID]
        }
      ]);
    });

    it("touches updated_at when the payload holds nothing else", async () => {
      const { dataKeyRepository, executedQueries } = setup();

      await executeAgainstStubbedDriver(() => dataKeyRepository.updateBy({ id: DATA_KEY_ID }, {}));

      expect(executedQueries).toEqual([
        {
          query: 'update "data_keys" set "updated_at" = now() where "data_keys"."id" = $1',
          params: [DATA_KEY_ID]
        }
      ]);
    });

    it("leaves out updated_at on a table that has no such column", async () => {
      const { userRepository, executedQueries } = setup();

      await executeAgainstStubbedDriver(() => userRepository.updateBy({ id: USER_ID }, { bio: "hello" }));

      expect(executedQueries).toEqual([
        {
          query: 'update "userSetting" set "bio" = $1 where "userSetting"."id" = $2',
          params: ["hello", USER_ID]
        }
      ]);
    });
  });

  describe("updateById", () => {
    it("stamps updated_at", async () => {
      const { dataKeyRepository, executedQueries } = setup();

      await executeAgainstStubbedDriver(() => dataKeyRepository.updateById(DATA_KEY_ID, { wrappedByKid: "kms-v2" }));

      expect(executedQueries).toEqual([
        {
          query: 'update "data_keys" set "wrapped_by_kid" = $1, "updated_at" = now() where "data_keys"."id" = $2',
          params: ["kms-v2", DATA_KEY_ID]
        }
      ]);
    });
  });

  describe("updateManyById", () => {
    it("stamps updated_at on every matched row", async () => {
      const { dataKeyRepository, executedQueries } = setup();

      await executeAgainstStubbedDriver(() => dataKeyRepository.updateManyById([DATA_KEY_ID, OTHER_DATA_KEY_ID], { wrappedByKid: "kms-v2" }));

      expect(executedQueries).toEqual([
        {
          query: 'update "data_keys" set "wrapped_by_kid" = $1, "updated_at" = now() where "data_keys"."id" in ($2, $3)',
          params: ["kms-v2", DATA_KEY_ID, OTHER_DATA_KEY_ID]
        }
      ]);
    });
  });

  async function executeAgainstStubbedDriver(run: () => Promise<unknown>) {
    await expect(run()).rejects.toThrow(DrizzleQueryError);
  }

  function setup() {
    const executedQueries: Array<{ query: string; params: unknown[] }> = [];
    const client = postgres("postgres://localhost:5432/unused");
    vi.spyOn(client, "unsafe").mockImplementation((query, params) => {
      executedQueries.push({ query, params: params ?? [] });
      throw new Error(UNREACHABLE_DRIVER);
    });
    const driverlessDb = drizzle(client);
    const pg = mock<ApiPgDatabase>({ update: driverlessDb.update.bind(driverlessDb) });
    const txManager = mock<TxService>();

    return {
      executedQueries,
      dataKeyRepository: new DataKeyRepository(pg, DataKeys, txManager),
      userRepository: new UserRepository(pg, Users, txManager)
    };
  }
});
