import { faker } from "@faker-js/faker";

export class AkashAddressSeeder {
  static create(): string {
    return `akash${faker.string.alphanumeric({ length: 39 })}`;
  }
}
