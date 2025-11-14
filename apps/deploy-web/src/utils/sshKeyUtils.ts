import { fromBase64, toBase64 } from "./encoding";

export interface OpenSshKeyPair {
  /** e.g. `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ... my-key@host` */
  publicKey: string;
  /** PKCS#8 PEM private key */
  privatePem: string;
}

/**
 * Generate a 2048-bit RSA keypair and return:
 * - OpenSSH-formatted public key (authorized_keys style)
 * - PKCS#8 PEM private key
 *
 * Requires WebCrypto (browser: window.crypto.subtle).
 */
export async function generateSSHKeyPair(comment = "user@host"): Promise<OpenSshKeyPair> {
  const keyPair = await generateRsaKeyPair();

  const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const pkcs8B64 = toBase64(new Uint8Array(pkcs8));
  const privatePem = base64ToPem(pkcs8B64, "RSA PRIVATE KEY");

  const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const publicKey = makeOpenSshPublicKeyFromJwk(jwk, comment);

  return { publicKey, privatePem };
}

async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5", // commonly used with "ssh-rsa"
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: "SHA-256"
    },
    true, // extractable
    ["sign", "verify"]
  );
}

function base64ToPem(b64: string, label: string): string {
  const lines = b64.match(/.{1,64}/g) || [];
  return [`-----BEGIN ${label}-----`, ...lines, `-----END ${label}-----`, ""].join("\n");
}

function base64UrlToUint8(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) base64 += "=".repeat(4 - pad);
  return fromBase64(base64);
}

// SSH mpint encoding (RFC 4251)
function toMpint(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 0) return new Uint8Array([0]);
  // If MSB is set, prepend 0x00
  if (bytes[0] & 0x80) {
    const out = new Uint8Array(bytes.length + 1);
    out[0] = 0;
    out.set(bytes, 1);
    return out;
  }
  return bytes;
}

/**
 * Build "ssh-rsa AAAA.... comment" from a JWK RSA public key.
 */
function makeOpenSshPublicKeyFromJwk(jwk: JsonWebKey, comment: string): string {
  if (!jwk.n || !jwk.e) {
    throw new Error("JWK is missing modulus (n) or exponent (e)");
  }

  const encoder = new TextEncoder();
  const type = encoder.encode("ssh-rsa");
  const eBytes = toMpint(base64UrlToUint8(jwk.e));
  const nBytes = toMpint(base64UrlToUint8(jwk.n));

  const total = 4 + type.length + 4 + eBytes.length + 4 + nBytes.length;

  const finalKey = new Uint8Array(total);
  const view = new DataView(finalKey.buffer);
  let offset = 0;

  function writeField(bytes: Uint8Array) {
    view.setUint32(offset, bytes.length); // big-endian
    offset += 4;
    finalKey.set(bytes, offset);
    offset += bytes.length;
  }

  writeField(type);
  writeField(eBytes);
  writeField(nBytes);

  return `ssh-rsa ${toBase64(finalKey)} ${comment}`;
}
