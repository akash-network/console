import { roundDecimal } from "./mathHelpers";

export const byteUnits = ["Bytes", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
export const bibyteUnits = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];

/** Byte multiplier for every size suffix an SDL may use: the binary `Mi` family and the decimal `M` / `Mb` ones. */
const sizeSuffixBytes: Record<string, number> = {
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
  Pi: 1024 ** 5,
  Ei: 1024 ** 6,
  K: 1000,
  M: 1000 ** 2,
  G: 1000 ** 3,
  T: 1000 ** 4,
  P: 1000 ** 5,
  E: 1000 ** 6,
  Kb: 1000,
  Mb: 1000 ** 2,
  Gb: 1000 ** 3,
  Tb: 1000 ** 4,
  Pb: 1000 ** 5,
  Eb: 1000 ** 6
};

/** Longest suffix first so `Mi` and `Mb` are matched before the `M` they both start with. */
const sizeSuffixesLongestFirst = Object.keys(sizeSuffixBytes).sort((a, b) => b.length - a.length);

/**
 * Bytes for an SDL size string — a binary suffix (`512Mi`), a decimal one (`2G`, `500Mb`), or a bare number
 * already in bytes. Undefined when the value carries no number at all, so callers can fall back to a placeholder
 * instead of rendering NaN. An unrecognized suffix leaves the leading number to stand as raw bytes.
 */
export function sizeStringToBytes(size: string): number | undefined {
  const suffix = sizeSuffixesLongestFirst.find(candidate => size.toLowerCase().endsWith(candidate.toLowerCase()));
  const value = parseFloat(suffix ? size.slice(0, -suffix.length) : size);

  if (Number.isNaN(value)) return undefined;

  return suffix ? value * sizeSuffixBytes[suffix] : value;
}

/** A byte count as a decimal-unit label, e.g. `536.87 MB`. The one byte format the deployment detail page uses. */
export function formatByteSize(bytes: number): string {
  const { value, unit } = bytesToShrink(bytes);
  return `${roundDecimal(value, 2)} ${unit}`;
}

export function bytesToShrink(value: number, bibyte?: boolean) {
  const multiplier = bibyte ? 1024 : 1000;
  const units = bibyte ? bibyteUnits : byteUnits;
  const isNegative = value < 0;
  const magnitude = Math.abs(value);
  /** Clamped to the unit list: anything below one unit stays in bytes, anything above the last unit stays in it. */
  const unitIndex = magnitude === 0 ? 0 : Math.min(Math.max(Math.floor(Math.log(magnitude) / Math.log(multiplier)), 0), units.length - 1);
  const finalValue = magnitude / Math.pow(multiplier, unitIndex);

  return { value: isNegative ? -finalValue : finalValue, unit: units[unitIndex] };
}

export function toBytes(size: number, type: string, bibyte?: boolean) {
  const key = bibyte ? bibyteUnits.indexOf(type) : byteUnits.indexOf(type.toUpperCase());

  if (key === -1) throw new Error("Invalid unit type: " + type);

  const multiplier = bibyte ? 1024 : 1000;

  if (typeof key !== "boolean") {
    return size * multiplier ** key;
  }
  return "invalid type: type must be GB/KB/MB etc.";
}
