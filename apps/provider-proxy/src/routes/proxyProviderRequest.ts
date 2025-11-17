import { createRoute, z } from "@hono/zod-openapi";
import type { TypedResponse } from "hono";
import type { ClientErrorStatusCode } from "hono/utils/http-status";
import { Readable } from "stream";
import type { ReadableStreamDefaultReader } from "stream/web";

import type { AppContext } from "../types/AppContext";
import { canRetryOnError, httpRetry } from "../utils/retry";
import { addProviderAuthValidation, providerRequestSchema } from "../utils/schema";

const RequestPayload = addProviderAuthValidation(
  providerRequestSchema.extend({
    method: z.enum(["GET", "POST", "PUT", "DELETE"]),
    body: z.string().optional(),
    timeout: z.number().default(10_000).optional()
  })
);

export const proxyRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RequestPayload
        }
      }
    }
  },
  responses: {
    400: {
      content: {
        "text/plain": {
          schema: z.string()
        }
      },
      description: "Returned if it's not possible to establish secure connection with proxied host"
    },
    495: {
      // https://http.dev/495
      content: {
        "text/plain": {
          schema: z.string()
        }
      },
      description: "Returned if host SSL certificate is invalid"
    },
    200: {
      description: "Returns proxied response"
    }
  }
});

export async function proxyProviderRequest(ctx: AppContext): Promise<Response | TypedResponse<string>> {
  const { method, body, url, providerAddress, timeout, auth } = ctx.req.valid("json" as never) as z.infer<typeof RequestPayload>;

  ctx.get("container").appLogger?.info({
    event: "PROXY_REQUEST",
    url,
    method,
    providerAddress,
    timeout
  });
  const clientAbortSignal = ctx.req.raw.signal;
  const proxyResult = await httpRetry(
    () =>
      ctx.get("container").providerProxy.connect(url, {
        method,
        body,
        auth,
        providerAddress,
        timeout,
        signal: clientAbortSignal
      }),
    {
      retryIf(result) {
        const isServerError = result.ok && (!result.response.statusCode || result.response.statusCode >= 500);
        const isConnectionError = result.ok === false && result.code === "connectionError" && canRetryOnError(result.error);
        return !clientAbortSignal.aborted && (isServerError || isConnectionError);
      },
      logger: ctx.get("container").appLogger
    }
  );

  if (clientAbortSignal.aborted) {
    return ctx.text("Request aborted", 499 as ClientErrorStatusCode);
  }

  if (proxyResult.ok === false && proxyResult.code === "insecureConnection") {
    return ctx.text("Could not establish tls connection since server responded with non-tls response", 400);
  }

  if (proxyResult.ok === false && proxyResult.code === "invalidCertificate") {
    return ctx.text(`Invalid certificate error: ${proxyResult.reason}`, 495 as ClientErrorStatusCode);
  }

  if (proxyResult.ok === false && proxyResult.code === "connectionError") {
    ctx.get("container").appLogger?.warn({
      event: "PROXY_REQUEST_ERROR",
      url,
      method,
      providerAddress,
      error: proxyResult.error
    });

    if (
      proxyResult.error &&
      typeof proxyResult.error === "object" &&
      proxyResult.error &&
      "code" in proxyResult.error &&
      String(proxyResult.error.code).startsWith("ERR_SSL_")
    ) {
      return ctx.json(
        {
          error: {
            code: "custom",
            issues: [
              {
                path: ["auth", "certPem"],
                params: {
                  reason: "invalid"
                }
              }
            ]
          }
        },
        400
      );
    }

    return ctx.text(`Provider ${new URL(url).origin} is temporarily unavailable`, 503);
  }

  const headers = new Headers();
  Object.keys(proxyResult.response.headers).forEach(header => {
    const value = proxyResult.response.headers[header];
    if (Array.isArray(value)) {
      value.forEach(v => headers.set(header, v));
    } else if (value) {
      headers.set(header, value);
    }
  });

  if (proxyResult.response.statusCode === 500) {
    const chunkedBody = await Array.fromAsync<Buffer>(Readable.toWeb(proxyResult.response));
    const body = chunkedBody.reduce((acc, chunk) => Buffer.concat([acc, chunk]), Buffer.alloc(0)).toString();
    const isValidationServerError = ctx.get("container").providerService.isValidationServerError(body);
    if (isValidationServerError) return ctx.text(body, 400);

    ctx.get("container").appLogger?.error({
      event: "PROXY_REQUEST_ERROR",
      url,
      method,
      providerAddress,
      httpResponse: {
        status: proxyResult.response.statusCode,
        headers: proxyResult.response.headers,
        body
      }
    });
    return ctx.text(`Provider ${new URL(url).origin} is temporarily unavailable`, 503);
  }

  const proxyStream = streamIgnoreAbortError(Readable.toWeb(proxyResult.response) as ReadableStream<any>, clientAbortSignal);

  return new Response(proxyStream, {
    status: proxyResult.response.statusCode ?? 502,
    statusText: proxyResult.response.statusMessage,
    headers
  });
}

function streamIgnoreAbortError(stream: ReadableStream<any>, clientAbortSignal: AbortSignal) {
  const ignoreAbortError = (error: Error) => {
    if (error && "code" in error && error.code === "ECONNRESET" && clientAbortSignal.aborted) {
      return { done: true, value: null };
    }
    throw error;
  };

  let streamReader: ReadableStreamDefaultReader<any> | undefined;
  return new ReadableStream({
    async start(controller) {
      streamReader = stream.getReader();
      while (streamReader) {
        const { done, value } = await streamReader.read().catch(ignoreAbortError);
        if (done) break;
        controller.enqueue(value);
      }
      streamReader?.releaseLock();
      streamReader = undefined;
      controller.close();
    },
    cancel() {
      streamReader?.releaseLock();
      streamReader = undefined;
      stream.cancel();
    }
  });
}
