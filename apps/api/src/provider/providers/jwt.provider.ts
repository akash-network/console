import * as jwt from "@akashnetwork/jwt";
import type { InjectionToken } from "tsyringe";
import { container } from "tsyringe";

export type JWTModule = typeof jwt;
export const JWT_MODULE: InjectionToken<JWTModule> = "JWT_MODULE";

container.register(JWT_MODULE, {
  useValue: jwt
});
