export * from "@src/user/routes/create-anonymous-user/create-anonymous-user.router";
export * from "@src/user/routes/get-anonymous-user/get-anonymous-user.router";
import { userApiKeysRouter } from "./user-api-keys/user-api-keys.router";

export const userRoutes = {
  userApiKeys: userApiKeysRouter
};
