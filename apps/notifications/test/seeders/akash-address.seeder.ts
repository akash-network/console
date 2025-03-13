import { faker } from '@faker-js/faker';

export const mockAkashAddress = () =>
  `akash${faker.string.alphanumeric({ length: 39 })}`;
