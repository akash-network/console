import type { BackoffOptions } from "exponential-backoff";
import { backOff } from "exponential-backoff";

export const MESSAGE = "Received empty value";
type EmptyResult = null | undefined;

type ValueBackoffOptions = Omit<BackoffOptions, "retry"> & {
  safe?: boolean;
  createError?: () => Error;
};

export function valueBackoff<T>(request: () => Promise<T>): Promise<T>;
export function valueBackoff<T>(request: () => Promise<T>, options: Omit<ValueBackoffOptions, "safe">): Promise<T>;
export function valueBackoff<T>(request: () => Promise<T>, options: ValueBackoffOptions & { safe: false }): Promise<T>;
export function valueBackoff<T>(request: () => Promise<T | EmptyResult>, options: ValueBackoffOptions & { safe: true }): Promise<T | EmptyResult>;
export function valueBackoff<T>(request: () => Promise<T | EmptyResult>, options: ValueBackoffOptions = {}): Promise<T | EmptyResult> {
  let emptyResult: EmptyResult = undefined;

  return backOff(
    async () => {
      const result = await request();

      if (result === undefined || result === null) {
        emptyResult = result as EmptyResult;
        throw new Error("Received empty value");
      }

      return result;
    },
    {
      ...options,
      retry: isInternalError
    }
  ).catch(error => {
    if (isInternalError(error) && options.safe) {
      return emptyResult;
    }
    return Promise.reject(options.createError ? options.createError() : error);
  });
}

function isInternalError(error: unknown) {
  return error instanceof Error && error.message === MESSAGE;
}
