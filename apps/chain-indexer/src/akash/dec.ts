/**
 * Fixed-point decimal math mirroring cosmos-sdk's LegacyDec: values are bigint atomics at 10^-18
 * scale. Escrow settlement must reproduce the chain's arithmetic exactly, which JS floats cannot
 * (the legacy indexer's DOUBLE drift is the bug being fixed) and no decimal library replicates
 * LegacyDec's two-step truncate-then-round quotient, so the four operations the keeper uses are
 * implemented here directly.
 */
export const DEC_ONE = 10n ** 18n;

const SQUARED_PRECISION = DEC_ONE * DEC_ONE;

export function decFromString(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) throw new Error(`Invalid decimal string: ${value}`);
  const [, sign, integerPart, fractionalPart = ""] = match;
  if (fractionalPart.length > 18) throw new Error(`Decimal exceeds 18 fractional digits: ${value}`);
  const atomics = BigInt(integerPart) * DEC_ONE + BigInt(fractionalPart.padEnd(18, "0"));
  return sign === "-" ? -atomics : atomics;
}

export function decFromInt(value: bigint | number): bigint {
  return BigInt(value) * DEC_ONE;
}

export function decToString(atomics: bigint): string {
  const sign = atomics < 0n ? "-" : "";
  const abs = atomics < 0n ? -atomics : atomics;
  const integerPart = abs / DEC_ONE;
  const fractionalPart = (abs % DEC_ONE).toString().padStart(18, "0").replace(/0+$/, "");
  return `${sign}${integerPart}${fractionalPart ? `.${fractionalPart}` : ""}`;
}

/** LegacyDec chopPrecisionAndRound: divide by 10^18 rounding half away from zero. */
function chopPrecisionAndRound(value: bigint): bigint {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const quotient = abs / DEC_ONE;
  const remainder = abs % DEC_ONE;
  const rounded = remainder * 2n >= DEC_ONE ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

export function decMul(a: bigint, b: bigint): bigint {
  return chopPrecisionAndRound(a * b);
}

export function decMulInt(a: bigint, b: bigint): bigint {
  return a * b;
}

/**
 * LegacyDec Quo: scale the numerator by 10^36, truncate-divide by the denominator, then chop back
 * one precision with rounding. The intermediate truncation is part of the chain's semantics, so the
 * two steps are kept distinct instead of rounding a single 10^18-scaled quotient.
 */
export function decQuo(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error("Division by zero");
  return chopPrecisionAndRound((a * SQUARED_PRECISION) / b);
}

/** Truncate toward zero to a whole integer (not atomics), matching LegacyDec TruncateInt. */
export function decTruncateInt(atomics: bigint): bigint {
  return atomics / DEC_ONE;
}

/** Smallest integer (not atomics) greater than or equal to the value, matching LegacyDec Ceil for positive values. */
export function decCeilInt(atomics: bigint): bigint {
  const quotient = atomics / DEC_ONE;
  const remainder = atomics % DEC_ONE;
  return remainder > 0n ? quotient + 1n : quotient;
}

export function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
