import { JwtToken } from "./JwtToken.js";
import type { CosmosWallet } from "./types.js";

// Mock implementation of CosmosWallet
class MockWallet implements CosmosWallet {
  async enable(_chainId: string): Promise<void> {
    // Mock implementation
  }

  async getKey(_chainId: string): Promise<{ bech32Address: string; pubKey: Uint8Array }> {
    return {
      bech32Address: "akash1test...",
      pubKey: new Uint8Array(32)
    };
  }

  async signArbitrary(_chainId: string, _address: string, _data: string): Promise<{ signature: Uint8Array }> {
    return {
      signature: Buffer.from("mockSignature")
    };
  }
}

describe("JwtToken", () => {
  let jwtToken: JwtToken;
  let mockWallet: CosmosWallet;

  beforeEach(() => {
    mockWallet = new MockWallet();
    jwtToken = new JwtToken(mockWallet);
  });

  describe("createToken", () => {
    it("should create and sign a new JWT token with all required fields", async () => {
      const options = {
        issuer: "test-issuer",
        subject: "test-subject",
        audience: "test-audience",
        expiresIn: 3600 // 1 hour
      };

      const token = await jwtToken.createToken(options);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // JWT should have 3 parts: header.payload.signature

      // Decode the token to verify its contents
      const decoded = jwtToken.decodeToken(token);
      expect(decoded.iss).toBe(options.issuer);
      expect(decoded.sub).toBe(options.subject);
      expect(decoded.aud).toBe(options.audience);
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it("should create a token with optional fields", async () => {
      const options = {
        issuer: "test-issuer",
        subject: "test-subject",
        audience: "test-audience",
        notBefore: Math.floor(Date.now() / 1000),
        issuedAt: Math.floor(Date.now() / 1000),
        jwtId: "test-jti"
      };

      const token = await jwtToken.createToken(options);
      const decoded = jwtToken.decodeToken(token);

      expect(decoded.nbf).toBe(options.notBefore);
      expect(decoded.iat).toBe(options.issuedAt);
      expect(decoded.jti).toBe(options.jwtId);
    });
  });

  describe("decodeToken", () => {
    it("should decode a JWT token and verify its structure", async () => {
      const options = {
        issuer: "test-issuer",
        subject: "test-subject",
        audience: "test-audience"
      };

      const token = await jwtToken.createToken(options);
      const decoded = jwtToken.decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.iss).toBe(options.issuer);
      expect(decoded.sub).toBe(options.subject);
      expect(decoded.aud).toBe(options.audience);
      expect(decoded.iat).toBeDefined();
    });

    it("should handle malformed tokens", () => {
      expect(() => jwtToken.decodeToken("invalid.token")).toThrow();
    });
  });

  describe("validatePayload", () => {
    it("should validate a valid JWT payload with all required fields", () => {
      const payload = {
        iss: "test-issuer",
        sub: "test-subject",
        aud: "test-audience",
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      };

      expect(jwtToken.validatePayload(payload)).toBe(true);
    });

    it("should reject a payload missing required fields", () => {
      const payload = {
        iss: "test-issuer"
        // Missing sub and aud
      };

      expect(jwtToken.validatePayload(payload)).toBe(false);
    });

    it("should reject an expired payload", () => {
      const payload = {
        iss: "test-issuer",
        sub: "test-subject",
        aud: "test-audience",
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };

      expect(jwtToken.validatePayload(payload)).toBe(false);
    });

    it("should reject a payload with invalid not-before time", () => {
      const payload = {
        iss: "test-issuer",
        sub: "test-subject",
        aud: "test-audience",
        nbf: Math.floor(Date.now() / 1000) + 3600 // 1 hour in the future
      };

      expect(jwtToken.validatePayload(payload)).toBe(false);
    });
  });
});
