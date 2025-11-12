import { KEYUTIL } from "jsrsasign";

// Helper function to convert a number to a 4-byte big-endian buffer
function numberToBytes(num: number): number[] {
  return [(num >> 24) & 0xff, (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

// Helper function to convert hex string to bytes
function hexToBytes(hex: string): number[] {
  // Ensure even length
  if (hex.length % 2 !== 0) {
    hex = "0" + hex;
  }
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16));
  }
  return bytes;
}

// Helper function to encode length-prefixed data
function encodeLengthPrefixed(data: number[] | string): number[] {
  const bytes = typeof data === "string" ? Array.from(data).map(c => c.charCodeAt(0)) : data;
  return [...numberToBytes(bytes.length), ...bytes];
}

// Convert RSA public key to OpenSSH format
export function rsaPublicKeyToOpenSSH(publicPem: string, comment = "user@host"): string {
  const keyObj = KEYUTIL.getKey(publicPem) as unknown as { n: { toString: (radix: number) => string }; e: { toString: (radix: number) => string } };
  
  // Get modulus and exponent as hex strings
  const nHex = keyObj.n.toString(16);
  const eHex = keyObj.e.toString(16);
  
  // Convert to byte arrays
  const nBytes = hexToBytes(nHex);
  const eBytes = hexToBytes(eHex);
  
  // Build the SSH public key format
  const sshRsaStr = "ssh-rsa";
  const parts: number[] = [
    ...encodeLengthPrefixed(sshRsaStr),
    ...encodeLengthPrefixed(eBytes),
    ...encodeLengthPrefixed(nBytes)
  ];
  
  // Convert to base64
  const base64 = btoa(String.fromCharCode(...parts));
  
  return `${sshRsaStr} ${base64} ${comment}`;
}

// Convert RSA private key to OpenSSH format
export function rsaPrivateKeyToOpenSSH(privatePem: string): string {
  // OpenSSH private key format header and footer
  return privatePem;
}

// Generate SSH key pair
export function generateSSHKeyPair() {
  // Generate RSA key pair using jsrsasign
  const kp = KEYUTIL.generateKeypair("RSA", 2048);
  const prvKeyObj = kp.prvKeyObj;
  const pubKeyObj = kp.pubKeyObj;

  // Convert keys to PEM format
  const privatePem = KEYUTIL.getPEM(prvKeyObj, "PKCS1PRV");
  const publicPem = KEYUTIL.getPEM(pubKeyObj);

  // Convert public key to OpenSSH format
  const publicKey = rsaPublicKeyToOpenSSH(publicPem);
  const privateKey = rsaPrivateKeyToOpenSSH(privatePem);

  return {
    publicKey,
    privateKey,
    publicPem,
    privatePem
  };
}
