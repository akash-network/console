export function generateTraceparent() {
  const traceId = crypto.getRandomValues(new Uint8Array(16)).reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
  const spanId = crypto.getRandomValues(new Uint8Array(8)).reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");

  return `00-${traceId}-${spanId}-01`;
}
