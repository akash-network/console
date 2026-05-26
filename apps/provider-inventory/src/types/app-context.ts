import type { Context, Env, Input } from "hono";

export interface AppContext<E extends Env = AppEnv, P extends string = string, I extends Input = Record<string, never>> extends Context<E, P, I> {}

export interface AppEnv extends Env {
  Variables: Env["Variables"];
}
