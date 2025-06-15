import { Day } from "@akashnetwork/database/dbSchemas/base/day";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

export class DaySeeder {
  static create(overrides: Partial<CreationAttributes<Day>> = {}): CreationAttributes<Day> {
    return {
      id: overrides.id || faker.string.uuid(),
      date: overrides.date || faker.date.recent(),
      aktPrice: overrides.aktPrice || faker.number.float({ min: 0, max: 100, multipleOf: 0.01 }),
      firstBlockHeight: overrides.firstBlockHeight || faker.number.int({ min: 1, max: 10000000 }),
      lastBlockHeight: overrides.lastBlockHeight || faker.number.int({ min: 1, max: 10000000 }),
      lastBlockHeightYet: overrides.lastBlockHeightYet || faker.number.int({ min: 1, max: 10000000 }),
      aktPriceChanged: overrides.aktPriceChanged !== undefined ? overrides.aktPriceChanged : faker.datatype.boolean()
    };
  }

  static async createInDatabase(overrides: Partial<CreationAttributes<Day>> = {}): Promise<Day> {
    const seed = DaySeeder.create(overrides);
    try {
      return await Day.create(seed);
    } catch (error) {
      console.error("Error creating Day in database:", error);
      throw error;
    }
  }
}
