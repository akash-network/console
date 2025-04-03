import type { Context } from "hono";

import type { Container } from "../container";

export type AppContext = Context<AppEnv>;

export type AppEnv = {
  Variables: {
    container: Container;
  };
};
