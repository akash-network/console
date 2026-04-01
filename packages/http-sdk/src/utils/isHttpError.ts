import { HttpError } from "../http/http-error";

export function isHttpError<T = any>(error: unknown): error is HttpError<T> {
  return error instanceof HttpError;
}
