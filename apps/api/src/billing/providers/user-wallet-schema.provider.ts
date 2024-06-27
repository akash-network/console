import { container, inject } from "tsyringe";

import { userWalletSchema } from "@src/billing/model-schemas";

export const USER_WALLET_SCHEMA = "USER_WALLET_SCHEMA";

container.register(USER_WALLET_SCHEMA, { useValue: userWalletSchema });

export type UserWalletSchema = typeof userWalletSchema;

export const InjectUserWalletSchema = () => inject(USER_WALLET_SCHEMA);
