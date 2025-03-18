export function pickRandomElement<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function round(amount: number, precision: number = 2) {
  return Math.round((amount + Number.EPSILON) * Math.pow(10, precision)) / Math.pow(10, precision);
}

export function uaktToAKT(amount: number, precision = 2) {
  return round(amount / 1_000_000, precision);
}

export function udenomToDenom(amount: number, precision = 2) {
  return round(amount / 1_000_000, precision);
}

export function median(values: number[]): number {
  if (values.length === 0) {
    throw new Error("Input array is empty");
  }

  const sortedValues = [...values].sort((a, b) => a - b);

  const half = Math.floor(sortedValues.length / 2);

  return sortedValues.length % 2 === 0 ? (sortedValues[half - 1] + sortedValues[half]) / 2 : sortedValues[half];
}

export function average(values: number[]): number {
  if (values.length === 0) {
    throw new Error("Input array is empty");
  }

  return values.reduce((acc, x) => acc + x, 0) / values.length;
}

export function weightedAverage(values: { value: number; weight: number }[]): number {
  if (values.length === 0) {
    throw new Error("Input array is empty");
  }

  const totalWeight = values.map(x => x.weight).reduce((acc, x) => acc + x, 0);

  return values.map(x => x.value * x.weight).reduce((acc, x) => acc + x, 0) / totalWeight;
}

export function denomToUdenom(amount: number, precision = 6) {
  return Math.round(amount * Math.pow(10, precision));
}
