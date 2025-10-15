const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

const isPrintableAscii = (str: string) => {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 32 || code > 126) {
      return false;
    }
  }
  return true;
};

export function decodeIfBase64(value: string): string {
  if (!value) return value;

  if (!base64Regex.test(value)) {
    return value;
  }

  try {
    const decoded = atob(value);
    const reencoded = btoa(decoded);

    if (reencoded !== value) {
      return value;
    }

    if (!isPrintableAscii(decoded) && isPrintableAscii(value)) {
      return value;
    }

    if (isPrintableAscii(decoded)) {
      return decoded;
    }

    return value;
  } catch {
    return value;
  }
}
