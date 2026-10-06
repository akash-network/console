import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { createProductUpdateUnsubscribeToken, readProductUpdateUnsubscribeToken } from "./product-update-unsubscribe-token";

describe(readProductUpdateUnsubscribeToken.name, () => {
  const secret = faker.string.alphanumeric(32);

  it("returns the user id of a token signed with the same secret", () => {
    const userId = faker.string.uuid();

    expect(readProductUpdateUnsubscribeToken(secret, createProductUpdateUnsubscribeToken(secret, userId))).toBe(userId);
  });

  it("creates a token that fits in a URL without escaping", () => {
    expect(createProductUpdateUnsubscribeToken(secret, faker.string.uuid())).toMatch(/^[0-9a-f-]{36}\.[\w-]{43}$/);
  });

  it("returns undefined for a token signed with another secret", () => {
    const token = createProductUpdateUnsubscribeToken(faker.string.alphanumeric(32), faker.string.uuid());

    expect(readProductUpdateUnsubscribeToken(secret, token)).toBeUndefined();
  });

  it("returns undefined when another user id is put in front of a valid signature", () => {
    const signature = createProductUpdateUnsubscribeToken(secret, faker.string.uuid()).split(".")[1];

    expect(readProductUpdateUnsubscribeToken(secret, `${faker.string.uuid()}.${signature}`)).toBeUndefined();
  });

  it("returns undefined for a truncated signature", () => {
    const token = createProductUpdateUnsubscribeToken(secret, faker.string.uuid());

    expect(readProductUpdateUnsubscribeToken(secret, token.slice(0, -1))).toBeUndefined();
  });

  it("returns undefined for a token without a signature", () => {
    expect(readProductUpdateUnsubscribeToken(secret, faker.string.uuid())).toBeUndefined();
  });

  it("returns undefined for a token without a user id", () => {
    const signature = createProductUpdateUnsubscribeToken(secret, "").split(".")[1];

    expect(readProductUpdateUnsubscribeToken(secret, `.${signature}`)).toBeUndefined();
  });
});
