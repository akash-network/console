import type { Jwks } from './get-jwks';

const ALGO = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };

export type VerificationResult = { payload: unknown | null };

export async function verify(
  token: string,
  jwks: Jwks,
): Promise<VerificationResult> {
  const { headerPayload, signature, payload } = parseToken(token);
  const verificationResults: VerificationResult[] = await Promise.all(
    jwks.keys.map(async (jwk: JsonWebKey) => {
      // Convert the matching JWK to a CryptoKey
      const publicKey = await crypto.subtle.importKey('jwk', jwk, ALGO, false, [
        'verify',
      ]);
      const isValid = await crypto.subtle.verify(
        ALGO,
        publicKey,
        signature,
        headerPayload,
      );
      return { payload: isValid ? payload : null };
    }),
  );
  return (
    verificationResults.filter((result) => result.payload !== null)[0] || {
      payload: null,
    }
  );
}

function parseToken(token: string): {
  headerPayload: Uint8Array;
  signature: Uint8Array;
  payload: unknown;
} {
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    throw new Error('Invalid token format');
  }

  let payload;
  try {
    // kid = JSON.parse(atob(tokenParts[0])).kid; - kid is optional. Cannot always expect.
    payload = JSON.parse(atob(tokenParts[1]));
  } catch (error) {
    throw new Error('Invalid token format');
  }
  const headerPayload = new TextEncoder().encode(
    `${tokenParts[0]}.${tokenParts[1]}`,
  );
  const signature = base64urlToUint8Array(tokenParts[2]);

  return { headerPayload, signature, payload };
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  const paddingLength = 4 - (base64url.length % 4);
  const padding = paddingLength < 4 ? '='.repeat(paddingLength) : '';
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
