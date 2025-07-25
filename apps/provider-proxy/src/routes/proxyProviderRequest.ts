import { createRoute, z } from "@hono/zod-openapi";
import type { TypedResponse } from "hono";
import type { ClientErrorStatusCode } from "hono/utils/http-status";
import { Readable } from "stream";

import type { AppContext } from "../types/AppContext";
import { canRetryOnError, httpRetry } from "../utils/retry";
import { addCertificateValidation, chainNetworkSchema, providerRequestSchema } from "../utils/schema";

const RequestPayload = addCertificateValidation(
  providerRequestSchema.extend({
    method: z.enum(["GET", "POST", "PUT", "DELETE"]),
    body: z.string().optional(),
    timeout: z.number().optional(),
    network: chainNetworkSchema
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

const DEFAULT_TIMEOUT = 10_000;
export async function proxyProviderRequest(ctx: AppContext): Promise<Response | TypedResponse<string>> {
  const { certPem, keyPem, method, body, url, network, providerAddress, timeout } = await ctx.req.json<z.infer<typeof RequestPayload>>();

  ctx.get("container").appLogger?.info({
    event: "PROXY_REQUEST",
    url,
    method,
    network,
    providerAddress,
    timeout
  });
  const proxyResult = await httpRetry(
    () =>
      ctx.get("container").providerProxy.connect(url, {
        method,
        body,
        cert: certPem,
        key: keyPem,
        network,
        providerAddress,
        timeout: Number(timeout || DEFAULT_TIMEOUT) || DEFAULT_TIMEOUT
      }),
    {
      retryIf(result) {
        const isServerError = result.ok && (!result.response.statusCode || result.response.statusCode > 500);
        const isConnectionError = result.ok === false && result.code === "connectionError" && canRetryOnError(result.error);
        return isServerError || isConnectionError;
      },
      logger: ctx.get("container").appLogger
    }
  );

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
      network,
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
                path: ["certPem"],
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
      network,
      providerAddress,
      httpResponse: {
        status: proxyResult.response.statusCode,
        headers: proxyResult.response.headers,
        body
      }
    });
    return ctx.text(`Provider ${new URL(url).origin} is temporarily unavailable`, 503);
  }

  return new Response(Readable.toWeb(proxyResult.response) as RequestInit["body"], {
    status: proxyResult.response.statusCode,
    statusText: proxyResult.response.statusMessage,
    headers
  });
}
