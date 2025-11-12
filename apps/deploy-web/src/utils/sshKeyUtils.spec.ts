import { generateSSHKeyPair, rsaPublicKeyToOpenSSH } from "./sshKeyUtils";

describe("sshKeyUtils", () => {
  describe("generateSSHKeyPair", () => {
    it("generates a valid SSH key pair", () => {
      const { publicKey, privateKey, publicPem, privatePem } = generateSSHKeyPair();

      // Check that all keys are generated
      expect(publicKey).toBeTruthy();
      expect(privateKey).toBeTruthy();
      expect(publicPem).toBeTruthy();
      expect(privatePem).toBeTruthy();

      // Check public key format
      expect(publicKey).toMatch(/^ssh-rsa\s+[A-Za-z0-9+/=]+\s+user@host$/);

      // Check private key format (should be PEM)
      expect(privateKey).toContain("-----BEGIN RSA PRIVATE KEY-----");
      expect(privateKey).toContain("-----END RSA PRIVATE KEY-----");
    });

    it("generates different keys on each call", () => {
      const keyPair1 = generateSSHKeyPair();
      const keyPair2 = generateSSHKeyPair();

      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
    });
  });

  describe("rsaPublicKeyToOpenSSH", () => {
    it("converts PEM to OpenSSH format with default comment", () => {
      const { publicPem } = generateSSHKeyPair();
      const opensshKey = rsaPublicKeyToOpenSSH(publicPem);

      expect(opensshKey).toMatch(/^ssh-rsa\s+[A-Za-z0-9+/=]+\s+user@host$/);
    });

    it("converts PEM to OpenSSH format with custom comment", () => {
      const { publicPem } = generateSSHKeyPair();
      const customComment = "test@example.com";
      const opensshKey = rsaPublicKeyToOpenSSH(publicPem, customComment);

      expect(opensshKey).toMatch(new RegExp(`^ssh-rsa\\s+[A-Za-z0-9+/=]+\\s+${customComment}$`));
    });

    it("produces consistent output for the same PEM", () => {
      const { publicPem } = generateSSHKeyPair();
      const opensshKey1 = rsaPublicKeyToOpenSSH(publicPem);
      const opensshKey2 = rsaPublicKeyToOpenSSH(publicPem);

      expect(opensshKey1).toBe(opensshKey2);
    });
  });
});
