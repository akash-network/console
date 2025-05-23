export function createContainer<T extends Factories>(factories: T): DIContainer<T> {
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
            throw new Error(`Circular dependency detected: ${resolvePath.concat(key).join(" -> ")}`);
          }
          resolvePath.push(key);
          try {
            instance = factories[key]();
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

export function createChildContainer<T extends Factories, U extends Factories>(parent: DIContainer<T>, factories: U): DIContainer<T & U> {
  const child = createContainer(factories as any);
  Object.setPrototypeOf(child, parent);
  return child;
}

export type DIContainer<T extends Factories> = {
  [K in keyof T]: ReturnType<T[K]>;
};

export type Factories = Record<string, () => any>;
