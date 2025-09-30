import type { Env, ExecutionContext, Hono, Schema } from "hono";

type RequestInfo = Request | string;

// eslint-disable-next-line @typescript-eslint/ban-types
export class AppHttpService<E extends Env = Env, S extends Schema = {}, BasePath extends string = "/"> {
  constructor(private readonly app: Hono<E, S, BasePath>) {}

  async request<R>(
    input: RequestInfo | URL,
    requestInit?: RequestInit,
    Env?: E["Bindings"] | object,
    executionCtx?: ExecutionContext
  ): Promise<{ response: Response; data: R }> {
    const result = await this.app.request(input, requestInit, Env, executionCtx);
    const data = (await result.json()) as R;

    return { response: result, data };
  }
}
