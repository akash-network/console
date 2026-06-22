/* v8 ignore start */

/**
 * @deprecated
 */
export function uint8arrayToString(arr: Uint8Array) {
  return new TextDecoder().decode(arr);
}
