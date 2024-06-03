type Matcher<T> = (a: T, b: T) => boolean;

export function createFilterUnique<T>(matcher: Matcher<T> = (a, b) => a === b): (value: T, index: number, array: T[]) => boolean {
  return (value, index, array) => {
    return array.findIndex(other => matcher(value, other)) === index;
  };
}
