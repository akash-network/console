import { OpenAPIHono, OpenAPIHonoOptions } from "@hono/zod-openapi";
import { Env, Hono, Schema } from "hono";
import { container } from "tsyringe";

import { HonoErrorHandlerService } from "@src/core/services/hono-error-handler/hono-error-handler.service";

type HonoInit<E extends Env> = ConstructorParameters<typeof Hono>[0] & OpenAPIHonoOptions<E>;

export class OpenApiHonoHandler<E extends Env = Env, S extends Schema = Record<string, never>, BasePath extends string = "/"> extends OpenAPIHono<
  E,
  S,
  BasePath
> {
  constructor(init?: Omit<HonoInit<E>, "defaultHook">) {
    super({
      ...init,
      defaultHook: (result, c) => {
        if (!result.success && "error" in result) {
          return container.resolve(HonoErrorHandlerService).handle(result.error, c);
        }
      }
    });
  }
}
