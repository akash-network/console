import { faker } from "@faker-js/faker";

export class AkashAddressSeeder {
  static create(): string {
    return `akash1${faker.string.alphanumeric({ length: 38, casing: "lower" })}`;
  }
}
