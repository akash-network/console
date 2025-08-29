export function kvArrayToObject<T extends string, V>(arr: { key: T; value: V }[]): Record<T, V>;
export function kvArrayToObject<T extends string, V>(arr: { key: T; value?: V }[]): Record<T, V | undefined>;
export function kvArrayToObject<T extends string, V>(arr: { key: T; value?: V }[] = []): Record<T, V | undefined> {
  return arr.reduce(
    (acc, { key, value }) => {
      (acc as Record<string, V | undefined>)[key] = value as V | undefined;
      return acc;
    },
    {} as Record<T, V | undefined>
  );
}
