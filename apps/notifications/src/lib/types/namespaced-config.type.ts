export type Namespaced<
  Namespace extends string,
  T extends Record<string, any>,
> = {
  [K in keyof T as `${Namespace}.${string & K}`]: T[K];
};
