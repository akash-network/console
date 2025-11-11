type Matcher<T> = (a: T, b: T) => boolean;

export function createFilterUnique<T>(matcher: Matcher<T> = (a, b) => a === b): (value: T, index: number, array: T[]) => boolean {
  return (value, index, array) => {
    return array.findIndex(other => matcher(value, other)) === index;
  };
}

export async function forEachGeneratedItem<T>(generator: AsyncGenerator<T>, onNext: (value: T) => void | Promise<void>) {
  for await (const item of generator) {
    await onNext(item);
  }
}
