import type { Context, Env, Input } from "hono";

import type { ClientInfoContextVariables } from "@src/middlewares/clientInfoMiddleware";

// eslint-disable-next-line @typescript-eslint/ban-types
export interface AppContext<E extends Env = AppEnv, P extends string = any, I extends Input = {}> extends Context<E, P, I> {}

export interface AppEnv extends Env {
  Variables: ClientInfoContextVariables & Env["Variables"];
}
