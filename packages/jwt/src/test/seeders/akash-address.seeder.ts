import { faker } from "@faker-js/faker";

export function createAkashAddress(): string {
  return `akash1${faker.string.alphanumeric({ length: 38, casing: "lower" })}`;
}
