export function* chunkify<T>(iter: Iterable<T>, size: number): Generator<readonly T[]> {
  if (Array.isArray(iter) && size >= iter.length) {
    yield iter;
    return;
  }

  const buf: T[] = new Array(size);
  let i = 0;
  for (const x of iter) {
    buf[i++] = x;
    if (i >= size) {
      yield [...buf];
      i = 0;
    }
  }

  if (i !== 0) {
    yield buf.slice(0, i);
  }
}
