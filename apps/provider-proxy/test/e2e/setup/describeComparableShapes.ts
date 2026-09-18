export type JsonShape = string | JsonShape[] | { [key: string]: JsonShape };

/** Two snapshots of a live document disagree on counters and element counts, and an array empty on either side says nothing about its elements. */
export function describeComparableShapes(left: unknown, right: unknown): [JsonShape, JsonShape] {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length === 0 || right.length === 0) return [[], []];

    const [leftElement, rightElement] = describeComparableShapes(left[0], right[0]);
    return [[leftElement], [rightElement]];
  }

  if (isRecord(left) && isRecord(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    const shapes = keys.map(key => [key, describeComparableShapes(left[key], right[key])] as const);

    return [
      Object.fromEntries(shapes.map(([key, [leftShape]]) => [key, leftShape])),
      Object.fromEntries(shapes.map(([key, [, rightShape]]) => [key, rightShape]))
    ];
  }

  return [describeType(left), describeType(right)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";

  return typeof value;
}
