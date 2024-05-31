export const byteUnits = ["Bytes", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
export const bibyteUnits = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];

export function bytesToShrink(value: number, bibyte?: boolean) {
  const multiplier = bibyte ? 1024 : 1000;
  let finalValue = 0;
  let finalUnit = bibyte ? bibyteUnits[0] : byteUnits[0];
  let isNegative = value < 0;
  const _value = Math.abs(value);

  if (_value !== 0) {
    const i = parseInt(Math.floor(Math.log(_value) / Math.log(multiplier)).toString());

    if (i !== 0) {
      finalValue = _value / Math.pow(multiplier, i);
      finalUnit = bibyte ? bibyteUnits[i] : byteUnits[i];
    }
  }

  return { value: isNegative ? -finalValue : finalValue, unit: finalUnit };
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
