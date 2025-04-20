import { jwtSchemaData } from "../generated/jwtSchemaData";

export class JwtSchema {
  /**
   * Get the JWT schema for Akash provider authentication
   * @returns The JWT schema as a JSON object
   */
  getSchema(): Record<string, any> {
    return jwtSchemaData;
  }

  /**
   * Get the required fields for a valid JWT token
   * @returns Array of required field names
   */
  getRequiredFields(): string[] {
    return jwtSchemaData.required || [];
  }

  /**
   * Get the properties defined in the JWT schema
   * @returns Object containing the properties
   */
  getProperties(): Record<string, any> {
    return jwtSchemaData.properties || {};
  }

  /**
   * Get the version of the JWT schema
   * @returns The version string
   */
  getVersion(): string {
    // The version is a property in the schema, not a top-level field
    return jwtSchemaData.properties?.version?.enum?.[0] || "unknown";
  }

  /**
   * Get the title of the JWT schema
   * @returns The title string
   */
  getTitle(): string {
    return jwtSchemaData.title || "Unknown Schema";
  }

  /**
   * Get the description of the JWT schema
   * @returns The description string
   */
  getDescription(): string {
    return jwtSchemaData.description || "No description available";
  }
}
