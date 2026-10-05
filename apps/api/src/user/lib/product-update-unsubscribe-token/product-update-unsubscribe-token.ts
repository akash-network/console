import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_PURPOSE = "product-updates-unsubscribe";

export function createProductUpdateUnsubscribeToken(secret: string, userId: string): string {
  return `${userId}.${sign(secret, userId).toString("base64url")}`;
}

export function readProductUpdateUnsubscribeToken(secret: string, token: string): string | undefined {
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0) return undefined;

  const userId = token.slice(0, separatorIndex);
  const signature = Buffer.from(token.slice(separatorIndex + 1), "base64url");
  const expectedSignature = sign(secret, userId);

  return signature.length === expectedSignature.length && timingSafeEqual(signature, expectedSignature) ? userId : undefined;
}

function sign(secret: string, userId: string): Buffer {
  return createHmac("sha256", secret).update(`${TOKEN_PURPOSE}:${userId}`).digest();
}
