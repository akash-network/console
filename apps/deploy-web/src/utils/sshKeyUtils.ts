import { KEYUTIL } from "jsrsasign";

import { toBase64 } from "./encoding";

function numberToBytes(num: number): number[] {
  return [(num >> 24) & 0xff, (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

function hexToBytes(hex: string): number[] {
  if (hex.length % 2 !== 0) {
    hex = "0" + hex;
  }
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

function encodeLengthPrefixed(data: number[] | string): number[] {
  const bytes = typeof data === "string" ? Array.from(data).map(c => c.charCodeAt(0)) : data;
  return [...numberToBytes(bytes.length), ...bytes];
}

export function rsaPublicKeyToOpenSSH(publicPem: string, comment = "user@host"): string {
  const keyObj = KEYUTIL.getKey(publicPem) as unknown as { n: { toString: (radix: number) => string }; e: { toString: (radix: number) => string } };
  
  const nHex = keyObj.n.toString(16);
  const eHex = keyObj.e.toString(16);
  
  const nBytes = hexToBytes(nHex);
  const eBytes = hexToBytes(eHex);
  
  const sshRsaStr = "ssh-rsa";
  const parts: number[] = [
    ...encodeLengthPrefixed(sshRsaStr),
    ...encodeLengthPrefixed(eBytes),
    ...encodeLengthPrefixed(nBytes)
  ];
  
  const base64 = toBase64(new Uint8Array(parts));
  
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
