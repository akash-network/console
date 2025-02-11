import { Context } from "hono";

import { Container } from "../container";

export type AppContext = Context<AppEnv>;

export type AppEnv = {
  Variables: {
    container: Container;
  };
};
