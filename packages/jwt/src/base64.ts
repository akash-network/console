export function base64UrlEncode(str: string): string {
  const base64 = Buffer.from(str).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode a base64 string
 * @param base64String The base64 string to decode
 * @returns The decoded object
 */
export function base64Decode(base64String: string): Record<string, any> {
  const decoded = Buffer.from(base64String, "base64").toString("utf8");
  return JSON.parse(decoded);
}
