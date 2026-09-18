export type JsonShape = string | JsonShape[] | { [key: string]: JsonShape };

/** Two snapshots of a live document disagree on counters and element counts, and an array empty on either side says nothing about its elements. */
export function describeComparableShapes(left: unknown, right: unknown): [JsonShape, JsonShape] {
  if (Array.isArray(left) && Array.isArray(right)) {
    const pairedElements = Math.min(left.length, right.length);
    if (pairedElements === 0) return [[], []];

    const shapes = Array.from({ length: pairedElements }, (_, index) => describeComparableShapes(left[index], right[index]));

    return [distinctShapes(shapes.map(([leftShape]) => leftShape)), distinctShapes(shapes.map(([, rightShape]) => rightShape))];
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

function distinctShapes(shapes: JsonShape[]): JsonShape[] {
  return [...new Map(shapes.map(shape => [JSON.stringify(shape), shape])).values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";

  return typeof value;
}
