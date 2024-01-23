export type GeneralKeyValueStore = {
  get: (key: string, format: 'json') => Promise<unknown>;
  put: (
    key: string,
    value: string,
    options: any,
  ) => Promise<void>;
};
export type KVNamespaceOrKeyValueStore = /*KVNamespace | */GeneralKeyValueStore;
export type KVStore = ReturnType<typeof useKVStore>;
const defaultValidator = <T>(value: unknown): value is T =>
  !!value && typeof value === 'object' && Object.keys(value).length > 0;

export function useKVStore(kvStore?: KVNamespaceOrKeyValueStore) {
  return {
    async get<T>(
      key: string,
      fetcher: () => Promise<T>,
      validator: (value: unknown) => value is T = defaultValidator<T>,
      cacheOptions?: { expirationTtl: number },
    ): Promise<T> {
      if (!kvStore) {
        // No storage is available. Fetch and return the value.
        const freshValue = await fetcher();
        if (validator(freshValue)) {
          return freshValue;
        }
        throw new Error('Invalid value: ' + JSON.stringify(freshValue));
      }

      const cachedValue = await kvStore.get(key, 'json');
      if (validator(cachedValue)) {
        return cachedValue;
      } else {
        const freshValue = await fetcher();
        if (validator(freshValue)) {
          await kvStore.put(key, JSON.stringify(freshValue), {
            ...cacheOptions,
          });
          return freshValue;
        }
        throw new Error('Invalid value: ' + JSON.stringify(freshValue));
      }
    },
  };
}
