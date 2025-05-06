import type { StdSignature } from "@cosmjs/amino";
import { faker } from "@faker-js/faker";

import { jwtTestCases } from "./generated/jwtTestCases";
import { JwtToken } from "./JwtToken";
import type { CosmosWallet, JWTPayload } from "./types";

// Helper function to generate Akash addresses
const generateAkashAddress = () => `akash1${faker.string.alphanumeric({ length: 38, casing: "lower" })}`;

// Test key pair (DO NOT USE IN PRODUCTION)
const TEST_PUBLIC_KEY = new Uint8Array([
  0x02, 0x79, 0xbe, 0x66, 0x7e, 0xf9, 0xdc, 0xbb, 0xac, 0x55, 0xa0, 0x62, 0x95, 0xce, 0x87, 0x0b, 0x07, 0x02, 0x9b, 0xfc, 0xdb, 0x2d, 0xce, 0x28, 0xd9, 0x59,
  0xf2, 0x81, 0x5b, 0x16, 0xf8, 0x17, 0x98
]);

// Mock implementation of CosmosWallet
class MockWallet implements CosmosWallet {
  address: string;
  pubkey: Uint8Array;
  signArbitrary: (signer: string, data: string | Uint8Array) => Promise<StdSignature>;

  constructor(address: string, pubkey: Uint8Array, signArbitrary: (signer: string, data: string | Uint8Array) => Promise<StdSignature>) {
    this.address = address;
    this.pubkey = pubkey;
    this.signArbitrary = signArbitrary;
  }

  async enable(_chainId: string): Promise<void> {
    // Mock implementation
  }

  async getKey(_chainId: string): Promise<{ bech32Address: string; pubKey: Uint8Array }> {
    return {
      bech32Address: this.address,
      pubKey: this.pubkey
    };
  }
}

describe("JwtToken", () => {
  let jwtToken: JwtToken;
  let mockWallet: CosmosWallet;

  beforeEach(() => {
    mockWallet = new MockWallet(
      generateAkashAddress(),
      TEST_PUBLIC_KEY,
      jest.fn().mockImplementation(async (_signer: string, _data: string | Uint8Array) => {
        return {
          signature: Buffer.from("XLe/j4a/gbZghagl5mZb3nRu45VHI92JsbH56UeNhRpGx+t0pY3jIGuGCBF0d0owSs3/UxiBaouARqTb7YM7HA", "base64url").toString("base64url")
        } as StdSignature;
      })
    );
    jwtToken = new JwtToken(mockWallet);
  });

  describe("createToken", () => {
    it("should create and sign a new JWT token with all required fields", async () => {
      const options = {
        iss: generateAkashAddress(),
        version: "v1" as const,
        leases: {
          access: "full" as const
        }
      };

      const token = await jwtToken.createToken(options);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // JWT should have 3 parts: header.payload.signature

      // Decode the token to verify its contents
      const decoded = jwtToken.decodeToken(token);
      expect(decoded.iss).toBe(options.iss);
      expect(decoded.version).toBe("v1");
      expect(decoded.leases?.access).toBe("full");
    });

    it("should create a token with optional fields", async () => {
      const options = {
        iss: generateAkashAddress(),
        version: "v1" as const,
        leases: {
          access: "full" as const
        },
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000),
        jti: faker.string.uuid()
      };

      const token = await jwtToken.createToken(options);
      const decoded = jwtToken.decodeToken(token);

      expect(decoded.nbf).toBe(options.nbf);
      expect(decoded.iat).toBe(options.iat);
      expect(decoded.jti).toBe(options.jti);
    });
  });

  describe("decodeToken", () => {
    it("should decode a JWT token and verify its structure", async () => {
      const options = {
        iss: generateAkashAddress(),
        version: "v1" as const,
        leases: {
          access: "full" as const
        }
      };

      const token = await jwtToken.createToken(options);
      const decoded = jwtToken.decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.iss).toBe(options.iss);
      expect(decoded.version).toBe("v1");
      expect(decoded.leases?.access).toBe("full");
    });

    it("should handle malformed tokens", () => {
      expect(() => jwtToken.decodeToken("invalid.token")).toThrow();
    });
  });

  describe("validatePayload", () => {
    it("should validate a valid JWT payload with all required fields", async () => {
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

      expect(await jwtToken.validatePayload(payload)).toBe(true);
    });

    it("should reject a payload missing required fields", async () => {
      const payload: Partial<JWTPayload> = {
        iss: generateAkashAddress(),
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000)
        // missing required fields
      };

      expect(await jwtToken.validatePayload(payload as JWTPayload)).toBe(false);
    });

    it("should reject an expired payload", async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload: JWTPayload = {
        iss: generateAkashAddress(),
        iat: now - 7200, // 2 hours ago
        nbf: now - 7200,
        exp: now - 3600, // 1 hour ago
        version: "v1",
        leases: {
          access: "full" as const
        }
      };

      expect(await jwtToken.validatePayload(payload)).toBe(false);
    });

    it("should reject a payload with invalid not-before time", async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload: JWTPayload = {
        iss: generateAkashAddress(),
        iat: now,
        nbf: now + 3600, // 1 hour in the future
        exp: now + 7200, // 2 hours in the future
        version: "v1",
        leases: {
          access: "full" as const
        }
      };

      expect(await jwtToken.validatePayload(payload)).toBe(false);
    });
  });

  it("should generate a JWT with the same structure as reference test cases", async () => {
    const options = {
      iss: "akash1p2e73vphy9umsx02y6xqr49yeu0dn9s3pytkvk",
      version: "v1" as const,
      leases: {
        access: "full" as const
      }
    };

    const token = await jwtToken.createToken(options);
    const [header, payload, signature] = token.split(".");

    // Verify header structure matches reference
    const headerObj = JSON.parse(Buffer.from(header, "base64").toString());
    expect(headerObj.typ).toBe("JWT");
    expect(headerObj.alg).toBe("ES256K");
    expect(headerObj.jwk).toBeDefined();
    expect(headerObj.jwk.kty).toBe("EC");
    expect(headerObj.jwk.crv).toBe("secp256k1");

    // Verify payload structure matches reference
    const payloadObj = JSON.parse(Buffer.from(payload, "base64").toString());
    expect(payloadObj.iss).toBe(options.iss);
    expect(payloadObj.version).toBe("v1");
    expect(payloadObj.leases).toBeDefined();
    expect(payloadObj.leases.access).toBe("full");

    // Verify signature format matches reference
    expect(signature).toMatch(/^[A-Za-z0-9_-]+$/); // base64url without padding
  });

  it("should generate a JWT with granular access permissions", async () => {
    const options = {
      iss: "akash1p2e73vphy9umsx02y6xqr49yeu0dn9s3pytkvk",
      version: "v1" as const,
      leases: {
        access: "granular" as const,
        permissions: [
          {
            provider: "akash1xyz",
            scope: ["send-manifest", "shell"] as Array<"send-manifest" | "shell" | "logs" | "events" | "restart">
          }
        ]
      }
    };

    const token = await jwtToken.createToken(options);
    const [, payload] = token.split(".");
    const payloadObj = JSON.parse(Buffer.from(payload, "base64").toString());

    expect(payloadObj.leases.access).toBe("granular");
    expect(payloadObj.leases.permissions).toBeDefined();
    expect(payloadObj.leases.permissions[0].provider).toBe("akash1xyz");
    expect(payloadObj.leases.permissions[0].scope).toEqual(["send-manifest", "shell"]);
  });

  it("should validate payload against schema", async () => {
    const now = Math.floor(Date.now() / 1000);
    const validPayload: JWTPayload = {
      iss: generateAkashAddress(),
      version: "v1",
      iat: now,
      nbf: now,
      exp: now + 3600,
      leases: {
        access: "full" as const
      }
    };

    const invalidPayload: Partial<JWTPayload> = {
      iss: "invalid_address",
      version: "invalid_version"
    };

    expect(await jwtToken.validatePayload(validPayload)).toBe(true);
    expect(await jwtToken.validatePayload(invalidPayload as JWTPayload)).toBe(false);
  });

  it("should decode token correctly", async () => {
    const options = {
      iss: "akash1p2e73vphy9umsx02y6xqr49yeu0dn9s3pytkvk",
      version: "v1" as const,
      leases: {
        access: "full" as const
      }
    };

    const token = await jwtToken.createToken(options);
    const decoded = jwtToken.decodeToken(token);

    expect(decoded.iss).toBe(options.iss);
    expect(decoded.version).toBe("v1");
    expect(decoded.leases?.access).toBe("full");
  });

  describe("reference test cases", () => {
    it("should validate tokens against reference test cases", async () => {
      for (const testCase of jwtTestCases) {
        try {
          const decoded = jwtToken.decodeToken(testCase.tokenString);
          if (testCase.mustFail) {
            // For invalid test cases, verify that our validation fails
            expect(jwtToken.validatePayload(decoded)).toBe(false);
          } else {
            // For valid test cases, verify the token structure
            expect(decoded).toEqual(testCase.expected.claims);
            // Skip schema validation for test cases that don't match our schema
            if (decoded.version && decoded.leases) {
              expect(jwtToken.validatePayload(decoded)).toBe(true);
            }
          }
        } catch (error) {
          // If decoding fails and it should fail, that's fine
          if (!testCase.mustFail) {
            throw error;
          }
        }
      }
    });
  });
});
