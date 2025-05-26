import { faker } from "@faker-js/faker";

export const genWalletAddress = () => `akash${faker.string.alphanumeric({ length: 39 })}`;
