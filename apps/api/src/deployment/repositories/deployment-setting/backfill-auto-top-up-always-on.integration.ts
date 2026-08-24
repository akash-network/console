import { faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import { DeploymentSettingRepository } from "./deployment-setting.repository";

describe("0042_backfill_auto_top_up_always_on migration", () => {
  it("switches an open deployment with funding off back to funded", async () => {
    const { deploymentSettingRepository, createSetting, replayMigration } = await setup();
    const setting = await createSetting({ autoTopUpEnabled: false });

    await replayMigration();

    expect(await deploymentSettingRepository.findById(setting.id)).toEqual(expect.objectContaining({ autoTopUpEnabled: true }));
  });

  it("leaves a closed deployment's opt-out in place", async () => {
    const { deploymentSettingRepository, createSetting, replayMigration } = await setup();
    const setting = await createSetting({ autoTopUpEnabled: false, closed: true });

    await replayMigration();

    expect(await deploymentSettingRepository.findById(setting.id)).toEqual(expect.objectContaining({ autoTopUpEnabled: false }));
  });

  it("does not rewrite rows that already fund automatically", async () => {
    const { deploymentSettingRepository, createSetting, replayMigration } = await setup();
    const setting = await createSetting({ autoTopUpEnabled: true });

    await replayMigration();

    expect(await deploymentSettingRepository.findById(setting.id)).toEqual(expect.objectContaining({ autoTopUpEnabled: true, updatedAt: setting.updatedAt }));
  });

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const userRepository = container.resolve(UserRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const user = await userRepository.create({ userId: faker.string.uuid() });

    async function createSetting(input: { autoTopUpEnabled: boolean; closed?: boolean }) {
      return deploymentSettingRepository.create({
        userId: user.id,
        dseq: faker.number.int({ min: 100000, max: 999999 }).toString(),
        ...input
      });
    }

    async function replayMigration() {
      const migration = fs.readFileSync(path.resolve(process.cwd(), "drizzle/0042_backfill_auto_top_up_always_on.sql"), "utf8");

      for (const statement of migration.split("--> statement-breakpoint")) {
        await db.execute(sql.raw(statement));
      }
    }

    return { deploymentSettingRepository, createSetting, replayMigration };
  }
});
