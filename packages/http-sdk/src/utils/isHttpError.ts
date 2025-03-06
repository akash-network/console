import { AxiosError } from "axios";

export function isHttpError<T = any>(error: unknown): error is AxiosError<T> {
  return !!error && error instanceof AxiosError;
}
