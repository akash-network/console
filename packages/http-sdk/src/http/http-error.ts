import type { HttpRequestConfig, HttpResponse } from "./http.types";

export class HttpError<T = unknown> extends Error {
  readonly response?: HttpResponse<T>;
  readonly config?: HttpRequestConfig;
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, code?: string, config?: HttpRequestConfig, response?: HttpResponse<T>) {
    super(message);
    this.name = "HttpError";
    this.code = code;
    this.config = config;
    this.response = response;
    this.status = response?.status;
  }
}
