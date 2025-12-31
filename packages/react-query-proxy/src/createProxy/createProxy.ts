import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";

export function createProxy<T extends Record<string, any>>(object: T, proxyOptions?: CreateProxyOptions): RecursiveHooksProxy<T> {
  return createRecursiveProxyImpl(object, proxyOptions);
}

export interface CreateProxyOptions {
  inputToKey?: (input: unknown) => PropertyKey[];
}

const proxyCache = new WeakMap<object, Record<string, any>>();
const defaultInputToKey = (input: unknown): unknown[] => (input == null ? [] : [input]);

function createRecursiveProxyImpl<T extends Record<string, any>>(
  object: T,
  proxyOptions?: CreateProxyOptions,
  fullPath: PropertyKey[] = []
): RecursiveHooksProxy<T> {
  if (!proxyCache.has(object)) {
    proxyCache.set(object, new Map());
  }

  const inputToKey = proxyOptions?.inputToKey ?? defaultInputToKey;
  const valueByPath = proxyCache.get(object)!;
  const stringifiedPath = fullPath.join(".");
  if (!valueByPath[stringifiedPath]) {
    valueByPath[stringifiedPath] = new Proxy(object, {
      get(target, prop) {
        if (!Object.hasOwn(target, prop)) return undefined;

        const value = (target as any)[prop];
        if ((typeof value !== "function" && typeof value !== "object") || value === null) {
          return value;
        }

        if (typeof value === "function") {
          const key = `${stringifiedPath}.${prop as string}`;
          const getKey = (input: unknown) => fullPath.concat(inputToKey(input) as PropertyKey[]);
          valueByPath[key] ??= {
            getKey,
            useQuery: (input, options) => {
              const queryKey = getKey(input);
              if (options?.queryKey) {
                queryKey.push(...(options.queryKey as PropertyKey[]));
              }
              return useQuery({
                ...options,
                queryKey,
                queryFn: () => (target as any)[prop](input)
              });
            },
            useMutation: options => {
              const mutationKey = fullPath;
              if (options?.mutationKey) {
                mutationKey.push(...(options.mutationKey as PropertyKey[]));
              }
              return useMutation({
                ...options,
                mutationKey,
                mutationFn: input => (target as any)[prop](input)
              });
            }
          } satisfies HooksProxy<typeof value>;
          return valueByPath[key];
        }

        return createRecursiveProxyImpl(value, proxyOptions, fullPath.concat(prop));
      }
    });
  }

  return valueByPath[stringifiedPath];
}

type RecursiveHooksProxy<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? HooksProxy<T[K]> : RecursiveHooksProxy<T[K]>;
};

type HooksProxy<T extends (...args: any[]) => any> = undefined extends Parameters<T>[0]
  ? {
      getKey: (input?: undefined) => PropertyKey[];
      useQuery: (
        input?: undefined,
        options?: Omit<UseQueryOptions<ReturnType<T>, Error, any, QueryKey>, "queryFn" | "queryKey"> & { queryKey?: QueryKey }
      ) => UseQueryResult<Awaited<ReturnType<T>>>;
      useMutation: (options?: Omit<UseMutationOptions<ReturnType<T>, Error, any, any>, "mutationFn">) => UseMutationResult<Awaited<ReturnType<T>>>;
    }
  : {
      getKey: (input: Parameters<T>[0]) => PropertyKey[];
      useQuery: (
        input: Parameters<T>[0],
        options?: Omit<UseQueryOptions<ReturnType<T>, Error, any, QueryKey>, "queryFn" | "queryKey"> & { queryKey?: QueryKey }
      ) => UseQueryResult<Awaited<ReturnType<T>>>;
      useMutation: (options?: Omit<UseMutationOptions<ReturnType<T>, Error, any, any>, "mutationFn">) => UseMutationResult<Awaited<ReturnType<T>>>;
    };
