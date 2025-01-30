import { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from "express";

import { container } from "../container";
import { httpRetry } from "../utils/retry";

const DEFAULT_TIMEOUT = 5_000;
export async function proxyProviderRequest(req: ExpressRequest, incommingResponse: ExpressResponse, next: NextFunction): Promise<void> {
  const { certPem, keyPem, method, body, url, network, providerAddress, timeout } = req.body;

  try {
    const proxyResult = await httpRetry(
      () =>
        container.providerProxy.connect(url, {
          method,
          body,
          cert: certPem,
          key: keyPem,
          network,
          providerAddress,
          timeout: Number(timeout || DEFAULT_TIMEOUT) || DEFAULT_TIMEOUT
        }),
      {
        retryIf: result => result.ok && (!result.response.statusCode || result.response.statusCode > 500)
      }
    );

    if (proxyResult.ok === false && proxyResult.code === "insecureConnection") {
      incommingResponse.status(400);
      incommingResponse.send("Could not establish tls connection since server responded with non-tls response");
      return;
    }

    if (proxyResult.ok === false && proxyResult.code === "invalidCertificate") {
      incommingResponse.status(495); // https://http.dev/495
      incommingResponse.send(`Invalid certificate error: ${proxyResult.reason}`);
      return;
    }

    Object.keys(proxyResult.response.headers).forEach(header => {
      incommingResponse.setHeader(header, proxyResult.response.headers[header] || "");
    });
    proxyResult.response.pipe(incommingResponse).on("error", next);
  } catch (error) {
    next(error);
  }
}
