import { JwtValidator } from "./JwtValidator";

describe("JwtValidator", () => {
  let validator: JwtValidator;

  beforeEach(() => {
    validator = new JwtValidator();
  });

  it("should validate a valid token", () => {
    const validToken =
      "eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJha2FzaDFhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejEyMzQ1Njc4OTBhYiIsImlhdCI6MTY1NDAwMDAwMCwiZXhwIjoxNjU0MDAzNjAwLCJuYmYiOjE2NTQwMDAwMDAsInZlcnNpb24iOiJ2MSIsImxlYXNlcyI6eyJhY2Nlc3MiOiJncmFudWxhciIsInBlcm1pc3Npb25zIjpbeyJwcm92aWRlciI6ImFrYXNoMWFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MTIzNDU2Nzg5MGFiIiwiYWNjZXNzIjoic2NvcGVkIiwic2NvcGUiOlsic2VuZC1tYW5pZmVzdCJdfV19fQ.signature";
    const result = validator.validateToken(validToken);
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.decodedToken).toBeDefined();
  });

  it("should reject a malformed token", () => {
    const result = validator.validateToken("not.a.valid.token");
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("Error validating token");
  });

  it("should validate required fields in header", () => {
    const result = validator.validateToken(
      "eyJ0eXAiOiJKV1QifQ.eyJpc3MiOiJha2FzaDFhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejEyMzQ1Njc4OTBhYiIsImlhdCI6MTY1NDAwMDAwMCwiZXhwIjoxNjU0MDAzNjAwLCJuYmYiOjE2NTQwMDAwMDAsInZlcnNpb24iOiJ2MSJ9.signature"
    );
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Missing required field in header: alg");
  });

  it("should validate required fields in payload", () => {
    const result = validator.validateToken("eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ.eyJmb28iOiJiYXIifQ.signature");
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Missing required field: iss");
    expect(result.errors).toContain("Missing required field: iat");
    expect(result.errors).toContain("Missing required field: exp");
    expect(result.errors).toContain("Missing required field: nbf");
    expect(result.errors).toContain("Missing required field: version");
    expect(result.errors).toContain("Missing required field: leases");
    expect(result.errors).toContain("Additional properties are not allowed");
  });

  it("should validate leases object when present", () => {
    const token =
      "eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJha2FzaDFhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejEyMzQ1Njc4OTBhYiIsImlhdCI6MTY1NDAwMDAwMCwiZXhwIjoxNjU0MDAzNjAwLCJuYmYiOjE2NTQwMDAwMDAsInZlcnNpb24iOiJ2MSIsImxlYXNlcyI6e319.signature";
    const result = validator.validateToken(token);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Missing required field: access");
  });

  it("should validate granular access requires permissions", () => {
    const token =
      "eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJha2FzaDFhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejEyMzQ1Njc4OTBhYiIsImlhdCI6MTY1NDAwMDAwMCwiZXhwIjoxNjU0MDAzNjAwLCJuYmYiOjE2NTQwMDAwMDAsInZlcnNpb24iOiJ2MSIsImxlYXNlcyI6eyJhY2Nlc3MiOiJncmFudWxhciJ9fQ.signature";
    const result = validator.validateToken(token);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Missing required field: permissions");
  });
});
