import type { Denom } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";

export class DenomSeeder {
  static create(): Denom {
    return faker.helpers.arrayElement(["uakt", "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1"]);
  }
}
