import { createSignArbitraryAkashWallet, JwtTokenManager } from "@akashnetwork/chain-sdk";
import type { InjectionToken } from "tsyringe";
import { container } from "tsyringe";

const jwt = {
  createSignArbitraryAkashWallet,
  JwtTokenManager
};

export type JWTModule = typeof jwt;
export const JWT_MODULE: InjectionToken<JWTModule> = "JWT_MODULE";

container.register(JWT_MODULE, {
  useValue: jwt
});
