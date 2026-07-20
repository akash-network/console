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
              const { catchError, ...restOptions } = options ?? {};
              const callSdk = () => (target as any)[prop](input);
              return useQueryImpl({
                ...restOptions,
                queryKey,
                queryFn: catchError
                  ? async () => {
                      try {
                        return await callSdk();
                      } catch (error) {
                        return catchError(error as Error);
                      }
                    }
                  : callSdk
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

/**
 * Mutation TVariables for an SDK function. When the function's first parameter is
 * optional or absent, allow `mutate()` with no args by widening to `void`; otherwise
 * preserve the typed input so consumers still get type-checked variables.
 */
type OptionalMutationVariables<T extends (...args: any[]) => any> = Parameters<T> extends [] ? void : Exclude<Parameters<T>[0], undefined> | void;

/**
 * Per-call useQuery options layered on react-query's, minus the fields the proxy owns
 * (`queryFn`, `queryKey`, which it re-adds as optional). `TQueryFnData` is the SDK call's
 * raw success type — it types the fields react-query feeds from cached data (`select`'s
 * input, `placeholderData`, `initialData`). `TData` is the shape the consumer observes,
 * inferred from `select` and otherwise defaulting to the success type unioned with the
 * `catchError` recovery. `catchError` recovers a rejected SDK call by returning a fallback
 * value (inferred as `TRecovered`); re-throw inside it to propagate as a normal query error.
 *
 * `TRecovered` is deliberately kept out of `UseQueryOptions` so its only inference site is
 * `catchError`'s return: unioning it into `TQueryFnData` would (a) let a generic value like
 * `placeholderData: keepPreviousData` infer `TRecovered` from its function type and pollute
 * `TData`, and (b) make `select`'s parameter depend on `TRecovered`, forcing it to resolve to
 * its `never` default before `catchError` is seen.
 */
export type ProxyQueryOptions<TQueryFnData, TData, TRecovered> = Omit<UseQueryOptions<TQueryFnData, Error, TData, QueryKey>, "queryFn" | "queryKey"> & {
  queryKey?: QueryKey;
  catchError?: (error: Error) => TRecovered;
};

type HooksProxy<T extends (...args: any[]) => any> = undefined extends Parameters<T>[0]
  ? {
      getKey: (input?: NonNullable<Parameters<T>[0]>) => PropertyKey[];
      useQuery: <TRecovered = never, TData = Awaited<ReturnType<T>> | TRecovered>(
        input?: NonNullable<Parameters<T>[0]>,
        options?: ProxyQueryOptions<Awaited<ReturnType<T>>, TData, TRecovered>
      ) => UseQueryResult<TData>;
      useMutation: (
        options?: Omit<UseMutationOptions<Awaited<ReturnType<T>>, Error, OptionalMutationVariables<T>, any>, "mutationFn">
      ) => UseMutationResult<Awaited<ReturnType<T>>, Error, OptionalMutationVariables<T>, any>;
    }
  : {
      getKey: (input: Parameters<T>[0]) => PropertyKey[];
      useQuery: <TRecovered = never, TData = Awaited<ReturnType<T>> | TRecovered>(
        input: Parameters<T>[0],
        options?: ProxyQueryOptions<Awaited<ReturnType<T>>, TData, TRecovered>
      ) => UseQueryResult<TData>;
      useMutation: (
        options?: Omit<UseMutationOptions<Awaited<ReturnType<T>>, Error, Parameters<T>[0], any>, "mutationFn">
      ) => UseMutationResult<Awaited<ReturnType<T>>, Error, Parameters<T>[0], any>;
    };
