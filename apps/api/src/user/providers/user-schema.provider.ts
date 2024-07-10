import { container, inject } from "tsyringe";

import { userSchema } from "@src/user/model-schemas";

export const USER_SCHEMA = "USER_SCHEMA";

container.register(USER_SCHEMA, { useValue: userSchema });

export type UserSchema = typeof userSchema;

export const InjectUserSchema = () => inject(USER_SCHEMA);
