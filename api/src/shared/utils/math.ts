export function pickRandomElement(arr: any[]) {
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