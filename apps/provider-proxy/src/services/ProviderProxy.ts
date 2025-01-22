import https, { RequestOptions } from "https";
import fetch, { BodyInit, Headers, Response } from "node-fetch";

export class ProviderProxy {
  fetch(url: string, options: FetchOptions): Promise<Response> {
    const httpsAgent = new https.Agent({
      cert: options.cert,
      key: options.key,
      rejectUnauthorized: false
    });

    return fetch(url, {
      method: options.method,
      body: options.body,
      headers: new Headers(options.headers),
      agent: httpsAgent
    });
  }
}

export interface FetchOptions extends Pick<RequestOptions, "cert" | "key" | "method"> {
  body?: BodyInit;
  headers?: Record<string, string>;
}
