import { faker } from "@faker-js/faker";
import { merge } from "lodash";

type Day = {
  id: string;
  date: Date;
  aktPrice?: number;
  firstBlockHeight: number;
  lastBlockHeight?: number;
  lastBlockHeightYet: number;
  aktPriceChanged: boolean;
};

export class DaySeeder {
  static create(input: Partial<Day> = {}): Day {
    return merge(
      {
        id: faker.string.uuid(),
        date: faker.date.past(),
        firstBlockHeight: faker.number.int({ min: 0, max: 10000000 }),
        lastBlockHeightYet: faker.number.int({ min: 0, max: 10000000 }),
        aktPriceChanged: faker.datatype.boolean()
      },
      input
    );
  }
}
