export function createContainer<T extends Record<string, (di: DIContainer<T>) => any>>(factories: T): DIContainer<T> {
  const accessor = {} as DIContainer<T>;
  const resolvePath: string[] = [];

  Object.keys(factories).forEach(key => {
    let instance: unknown = null;
    Object.defineProperty(accessor, key, {
      configurable: true,
      enumerable: true,
      get: () => {
        if (!instance) {
          if (resolvePath.includes(key)) {
            throw new Error(`Circular dependency detected: ${resolvePath.join(" -> ")}`);
          }
          resolvePath.push(key);
          try {
            instance = factories[key](accessor);
          } finally {
            resolvePath.pop();
          }
        }
        return instance;
      }
    });
  });

  return accessor;
}

export type DIContainer<T> = {
  [K in keyof T]: T[K] extends () => infer U ? U : never;
};
