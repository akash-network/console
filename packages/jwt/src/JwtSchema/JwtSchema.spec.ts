import { JwtSchema } from "./JwtSchema";

describe("JwtSchema", () => {
  let jwtSchema: JwtSchema;

  beforeEach(() => {
    jwtSchema = new JwtSchema();
  });

  it("should return the schema", () => {
    const schema = jwtSchema.getSchema();
    expect(schema).toBeDefined();
  });

  it("should return required fields", () => {
    const requiredFields = jwtSchema.getRequiredFields();
    expect(Array.isArray(requiredFields)).toBe(true);
    expect(requiredFields.length).toBeGreaterThan(0);
  });

  it("should return properties", () => {
    const properties = jwtSchema.getProperties();
    expect(properties).toBeDefined();
    expect(Object.keys(properties).length).toBeGreaterThan(0);
  });

  it("should return version", () => {
    const version = jwtSchema.getVersion();
    expect(typeof version).toBe("string");
    expect(version).toBe("v1");
  });

  it("should return title", () => {
    const title = jwtSchema.getTitle();
    expect(typeof title).toBe("string");
    expect(title).toBe("Akash JWT Schema");
  });

  it("should return description", () => {
    const description = jwtSchema.getDescription();
    expect(typeof description).toBe("string");
    expect(description).toBe("JSON Schema for JWT used in the Akash Provider API.");
  });
});
