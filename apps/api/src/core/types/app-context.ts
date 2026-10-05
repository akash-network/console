import type { Context, Env, Input } from "hono";

import type { ClientInfoContextVariables } from "@src/middlewares/clientInfoMiddleware";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppContext<E extends Env = AppEnv, P extends string = any, I extends Input = {}> extends Context<E, P, I> {}

export type AuthMethod = "bearer" | "api_key" | "none";

export interface AppEnv extends Env {
  Variables: ClientInfoContextVariables & { authMethod?: AuthMethod } & Env["Variables"];
}
