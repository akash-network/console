import { faker } from "@faker-js/faker";

import { JwtToken } from "./JwtToken";
import type { CosmosWallet, JWTPayload } from "./types";

// Helper function to generate Akash addresses
const generateAkashAddress = () => `akash1${faker.string.alphanumeric({ length: 38, casing: "lower" })}`;

// Test key pair (DO NOT USE IN PRODUCTION)
const TEST_PUBLIC_KEY = new Uint8Array([
  0x02, 0x79, 0xbe, 0x66, 0x7e, 0xf9, 0xdc, 0xbb, 0xac, 0x55, 0xa0, 0x62, 0x95, 0xce, 0x87, 0x0b, 0x07, 0x02, 0x9b, 0xfc, 0xdb, 0x2d, 0xce, 0x28, 0xd9, 0x59,
  0xf2, 0x81, 0x5b, 0x16, 0xf8, 0x17, 0x98
]);

const TEST_SIGNATURE = new Uint8Array([
  0x30, 0x44, 0x02, 0x20, 0x4e, 0x45, 0xe3, 0x7a, 0xfd, 0x2a, 0x60, 0x2c, 0x64, 0x5d, 0x27, 0x69, 0xd2, 0x81, 0x2a, 0x36, 0x4e, 0x9b, 0x8c, 0x8d, 0x6b, 0xf9,
  0x44, 0x1c, 0x2c, 0x2c, 0x2c, 0x2c, 0x02, 0x20, 0x1b, 0x3a, 0x84, 0x0d, 0x5b, 0x5e, 0x27, 0xff, 0x34, 0x5d, 0x21, 0x88, 0x16, 0x67, 0x76, 0x6c, 0x8f, 0xae,
  0x45, 0x42, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20
]);

// Mock implementation of CosmosWallet
class MockWallet implements CosmosWallet {
  async enable(_chainId: string): Promise<void> {
    // Mock implementation
  }

  async getKey(_chainId: string): Promise<{ bech32Address: string; pubKey: Uint8Array }> {
    return {
      bech32Address: generateAkashAddress(),
      pubKey: TEST_PUBLIC_KEY
    };
  }

  async signArbitrary(_chainId: string, _address: string, _data: string): Promise<{ signature: Uint8Array }> {
    return {
      signature: TEST_SIGNATURE
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
        issuer: generateAkashAddress(),
        subject: faker.string.uuid(),
        audience: faker.string.uuid(),
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
        issuer: generateAkashAddress(),
        subject: faker.string.uuid(),
        audience: faker.string.uuid(),
        notBefore: Math.floor(Date.now() / 1000),
        issuedAt: Math.floor(Date.now() / 1000),
        jwtId: faker.string.uuid()
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
        issuer: generateAkashAddress(),
        subject: faker.string.uuid(),
        audience: faker.string.uuid()
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
      const now = Math.floor(Date.now() / 1000);
      const payload: JWTPayload = {
        iss: generateAkashAddress(),
        iat: now,
        nbf: now,
        exp: now + 3600, // 1 hour from now
        version: "v1",
        leases: {
          access: "full" as const
        }
      };

      expect(jwtToken.validatePayload(payload)).toBe(true);
    });

    it("should reject a payload missing required fields", () => {
      const payload: JWTPayload = {
        iss: generateAkashAddress(),
        sub: faker.string.uuid(),
        aud: faker.string.uuid()
      };

      expect(jwtToken.validatePayload(payload)).toBe(false);
    });

    it("should reject an expired payload", () => {
      const payload: JWTPayload = {
        iss: generateAkashAddress(),
        sub: faker.string.uuid(),
        aud: faker.string.uuid(),
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };

      expect(jwtToken.validatePayload(payload)).toBe(false);
    });

    it("should reject a payload with invalid not-before time", () => {
      const payload: JWTPayload = {
        iss: generateAkashAddress(),
        sub: faker.string.uuid(),
        aud: faker.string.uuid(),
        nbf: Math.floor(Date.now() / 1000) + 3600 // 1 hour in the future
      };

      expect(jwtToken.validatePayload(payload)).toBe(false);
    });
  });
});
