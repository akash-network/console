import { faker } from "@faker-js/faker";

export const mockAkashAddress = (): string => `akash${faker.string.alphanumeric({ length: 39 })}`.toLowerCase();
