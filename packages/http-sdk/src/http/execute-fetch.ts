import type { HttpAdapter, HttpResponse } from "./http.types";
import { HttpError } from "./http-error";

export const executeFetch: HttpAdapter = async config => {
  let signal = config.signal;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timeoutController: AbortController | undefined;

  if (config.timeout) {
    timeoutController = new AbortController();
    timeoutId = setTimeout(() => timeoutController!.abort(), config.timeout);
    signal = config.signal ? AbortSignal.any([config.signal, timeoutController.signal]) : timeoutController.signal;
  }

  try {
    let body: BodyInit | undefined;
    if (config.data !== undefined && config.method !== "GET" && config.method !== "HEAD") {
      body = typeof config.data === "string" ? config.data : JSON.stringify(config.data);
    }

    const response = await fetch(config.url, {
      method: config.method,
      headers: config.headers,
      body,
      signal,
      credentials: config.withCredentials ? "include" : undefined
    });

    const data = await parseResponseBody(response, config.responseType);
    const headers = parseResponseHeaders(response.headers);

    const httpResponse: HttpResponse = { data, status: response.status, statusText: response.statusText, headers, config };

    const validate = config.validateStatus ?? (s => s >= 200 && s < 300);
    if (!validate(response.status)) {
      throw new HttpError(`Request failed with status code ${response.status}`, String(response.status), config, httpResponse);
    }

    return httpResponse;
  } catch (error) {
    if (error instanceof HttpError) throw error;

    let code = "ERR_NETWORK";
    if (error instanceof DOMException && error.name === "AbortError") {
      code = timeoutController?.signal.aborted ? "ECONNABORTED" : "ERR_CANCELED";
    } else if (error instanceof Error && "code" in error && typeof error.code === "string") {
      code = error.code;
    }

    throw new HttpError(error instanceof Error ? error.message : "Network Error", code, config);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

async function parseResponseBody(response: Response, responseType?: string): Promise<unknown> {
  if (responseType === "blob") return response.blob();
  if (responseType === "text") return response.text();
  if (responseType === "arraybuffer") return response.arrayBuffer();

  const text = await response.text();
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function parseResponseHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}
