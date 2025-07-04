import { AddressReference } from "@akashnetwork/database/dbSchemas/base";
import { faker } from "@faker-js/faker";
import type { CreationAttributes } from "sequelize";

export const createAddressReference = (input: Partial<CreationAttributes<AddressReference>> = {}): CreationAttributes<AddressReference> => {
  return {
    transactionId: input.transactionId || faker.string.uuid(),
    messageId: input.messageId || faker.string.uuid(),
    address: input.address || faker.string.hexadecimal({ length: 64 }),
    type: input.type || faker.string.alphanumeric({ length: 10 })
  };
};

export const createAddressReferenceInDatabase = async (input: Partial<CreationAttributes<AddressReference>> = {}): Promise<AddressReference> => {
  return await AddressReference.create(createAddressReference(input));
};
