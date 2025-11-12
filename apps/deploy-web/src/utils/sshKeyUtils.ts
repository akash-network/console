import { KEYUTIL } from "jsrsasign";

import { toBase64 } from "./encoding";

function numberToBytes(num: number): Uint8Array {
  return new Uint8Array([(num >> 24) & 0xff, (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]);
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    hex = "0" + hex;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function encodeLengthPrefixed(data: Uint8Array | string): Uint8Array {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const lengthBytes = numberToBytes(bytes.length);
  const result = new Uint8Array(lengthBytes.length + bytes.length);
  result.set(lengthBytes, 0);
  result.set(bytes, lengthBytes.length);
  return result;
}

export function rsaPublicKeyToOpenSSH(publicPem: string, comment = "user@host"): string {
  const keyObj = KEYUTIL.getKey(publicPem) as unknown as { n: { toString: (radix: number) => string }; e: { toString: (radix: number) => string } };
  
  const nHex = keyObj.n.toString(16);
  const eHex = keyObj.e.toString(16);
  
  const nBytes = hexToBytes(nHex);
  const eBytes = hexToBytes(eHex);
  
  const sshRsaStr = "ssh-rsa";
  const parts = [
    encodeLengthPrefixed(sshRsaStr),
    encodeLengthPrefixed(eBytes),
    encodeLengthPrefixed(nBytes)
  ];
  
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  
  const base64 = toBase64(result);
  
  return `${sshRsaStr} ${base64} ${comment}`;
}

export function generateSSHKeyPair() {
  const kp = KEYUTIL.generateKeypair("RSA", 2048);
  const prvKeyObj = kp.prvKeyObj;
  const pubKeyObj = kp.pubKeyObj;

  const privatePem = KEYUTIL.getPEM(prvKeyObj, "PKCS1PRV");
  const publicPem = KEYUTIL.getPEM(pubKeyObj);

  const publicKey = rsaPublicKeyToOpenSSH(publicPem);

  return {
    publicKey,
    privateKey: privatePem,
    publicPem,
    privatePem
  };
}
