const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function isPrintableAscii(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code > 126) {
      return false;
    }
  }
  return true;
}

/**
 * ABCI event attributes arrive base64-encoded on some CometBFT versions and plaintext on others, so the
 * decoder normalizes every key/value through this guard. A value is only decoded when it round-trips
 * through base64 exactly and yields printable ASCII, which keeps genuine plaintext (even plaintext that
 * happens to be valid base64) untouched. Ported from the legacy indexer to stay node-version agnostic.
 */
export function decodeIfBase64(value: string): string {
  if (!value || value.length % 4 !== 0 || !BASE64_PATTERN.test(value)) {
    return value;
  }

  try {
    const decoded = atob(value);

    if (btoa(decoded) !== value) {
      return value;
    }

    if (!isPrintableAscii(decoded) && isPrintableAscii(value)) {
      return value;
    }

    return isPrintableAscii(decoded) ? decoded : value;
  } catch {
    return value;
  }
}
