import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";

export function createProxy<T extends Record<string, any>>(object: T, proxyOptions?: CreateProxyOptions): RecursiveHooksProxy<T> {
  return createRecursiveProxyImpl(object, proxyOptions);
}

export interface CreateProxyOptions {
  inputToKey?: (input: unknown) => PropertyKey[];
  useQuery?: typeof useQuery;
  useMutation?: typeof useMutation;
}

const proxyCache = new WeakMap<object, Record<string, any>>();
const defaultInputToKey = (input: unknown): unknown[] => (input == null ? [] : [input]);

function createRecursiveProxyImpl<T extends Record<string, any>>(
  object: T,
  proxyOptions?: CreateProxyOptions,
  fullPath: PropertyKey[] = []
): RecursiveHooksProxy<T> {
  if (!proxyCache.has(object)) {
    proxyCache.set(object, {});
  }

  const inputToKey = proxyOptions?.inputToKey ?? defaultInputToKey;
  const valueByPath = proxyCache.get(object)!;
  const stringifiedPath = fullPath.join(".");
  if (!valueByPath[stringifiedPath]) {
    valueByPath[stringifiedPath] = new Proxy(object, {
      get(target, prop) {
        if (!(prop in target)) return undefined;

        const value = (target as any)[prop];
        if ((typeof value !== "function" && typeof value !== "object") || value === null) {
          return value;
        }

        const fullPropPath = fullPath.concat(prop);

        if (typeof value === "function") {
          const key = `${stringifiedPath}.${prop as string}`;
          const getKey = (input: unknown) => {
            const key = inputToKey(input) as PropertyKey[];
            return key && key.length > 0 ? fullPropPath.concat(key) : fullPropPath;
          };
          const useQueryImpl = proxyOptions?.useQuery ?? useQuery;
          const useMutationImpl = proxyOptions?.useMutation ?? useMutation;
          valueByPath[key] ??= {
            getKey,
            useQuery: (input, options) => {
              let queryKey = getKey(input);
              if (options?.queryKey) {
                queryKey = queryKey.concat(options.queryKey as PropertyKey[]);
              }
              return useQueryImpl({
                ...options,
                queryKey,
                queryFn: () => (target as any)[prop](input)
              });
            },
            useMutation: options => {
              let mutationKey = fullPropPath;
              if (options?.mutationKey) {
                mutationKey = mutationKey.concat(options.mutationKey as PropertyKey[]);
              }
              return useMutationImpl({
                ...options,
                mutationKey,
                mutationFn: input => (target as any)[prop](input)
              });
            }
          } satisfies HooksProxy<typeof value>;
          return valueByPath[key];
        }

        return createRecursiveProxyImpl(value, proxyOptions, fullPropPath);
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
