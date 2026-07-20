import type { OperationsTable } from "./client";

type ResolveOp<TPaths, TOp extends { path: string; method: string }> = TOp["path"] extends keyof TPaths
  ? TOp["method"] extends keyof TPaths[TOp["path"]]
    ? TPaths[TOp["path"]][TOp["method"]]
    : never
  : never;

type Params<R> = R extends { parameters: infer P } ? P : never;
type PathParam<R> = Params<R> extends { path?: infer X } ? (NonNullable<X> extends never ? never : NonNullable<X>) : never;
type QueryParam<R> = Params<R> extends { query?: infer X } ? (NonNullable<X> extends never ? never : X) : never;
type RequestBody<R> = R extends { requestBody?: infer RB } ? RB : never;
type Body<R> = NonNullable<RequestBody<R>> extends { content: { "application/json": infer B } } ? B : never;

/** Forces TypeScript to evaluate the intersection eagerly, avoiding deferred conditional types. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type FlatInput<R> = Prettify<
  ([PathParam<R>] extends [never] ? unknown : NonNullable<PathParam<R>>) &
    ([QueryParam<R>] extends [never] ? unknown : NonNullable<QueryParam<R>>) &
    ([Body<R>] extends [never] ? unknown : Body<R>)
>;

export type CallOptions = { headers?: Record<string, string>; signal?: AbortSignal };

type SuccessJson<R> = R extends { responses: infer Resps }
  ? Resps extends { 200: { content: { "application/json": infer T } } }
    ? T
    : Resps extends { 201: { content: { "application/json": infer T } } }
      ? T
      : Resps extends { 204: unknown }
        ? void
        : unknown
  : unknown;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type IsEmpty<T> = {} extends T ? true : false;

type CallSig<TPaths, TOp extends { path: string; method: string }> =
  IsEmpty<FlatInput<ResolveOp<TPaths, TOp>>> extends true
    ? (input?: FlatInput<ResolveOp<TPaths, TOp>>, options?: CallOptions) => Promise<SuccessJson<ResolveOp<TPaths, TOp>>>
    : (input: FlatInput<ResolveOp<TPaths, TOp>>, options?: CallOptions) => Promise<SuccessJson<ResolveOp<TPaths, TOp>>>;

export type TypedClient<TPaths, TOps extends OperationsTable> = {
  [G in keyof TOps]: {
    [O in keyof TOps[G]]: TOps[G][O] extends { path: string; method: string } ? CallSig<TPaths, TOps[G][O]> : never;
  };
};
