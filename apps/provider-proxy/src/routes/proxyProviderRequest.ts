import { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from "express";

import { container } from "../container";

export async function proxyProviderRequest(req: ExpressRequest, res: ExpressResponse, next: NextFunction): Promise<void> {
  const { certPem, keyPem, method, body, url } = req.body;

  try {
    const response = await container.providerProxy.fetch(url, {
      headers: {
        "Content-Type": "application/json"
      },
      method,
      body,
      cert: certPem,
      key: keyPem
    });

    if (response.status >= 200 && response.status < 300) {
      const responseText = await response.text();
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        res.contentType("application/json");
      } else {
        res.contentType("application/text");
      }
      res.send(responseText);
    } else {
      const _res = await response.text();
      console.log("Status code was not success (" + response.status + ") : " + _res);

      res.status(500);
      res.send(_res);
    }
  } catch (error) {
    next(error);
  }
}
