import { describe, expect, it } from "vitest";

import { generateSSHKeyPair } from "./sshKeyUtils";

describe(generateSSHKeyPair.name, () => {
  it("generates a valid SSH key pair", async () => {
    const { publicKey, privatePem } = await generateSSHKeyPair();

    expect(publicKey).toMatch(/^ssh-rsa\s+[A-Za-z0-9+/=]+\s+user@host$/);
    expect(privatePem).toContain("-----BEGIN RSA PRIVATE KEY-----");
    expect(privatePem).toContain("-----END RSA PRIVATE KEY-----");
  });

  it("generates different keys on each call", async () => {
    const keys = await Promise.all([generateSSHKeyPair(), generateSSHKeyPair()]);

    expect(keys[0].publicKey).not.toBe(keys[1].publicKey);
    expect(keys[0].privatePem).not.toBe(keys[1].privatePem);
  });
});
