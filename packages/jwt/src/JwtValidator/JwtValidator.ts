import Ajv from "ajv";
import addFormats from "ajv-formats";

import { jwtSchemaData } from "../generated/jwtSchemaData";
import type { JWTPayload } from "../types";

export interface JwtValidationResult {
  isValid: boolean;
  errors: string[];
  decodedToken?: {
    header: Record<string, any>;
    payload: Record<string, any>;
    signature: string;
  };
}

export class JwtValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      strictTypes: false,
      strictSchema: false
    });
    addFormats(this.ajv);
  }

  /**
   * Validate a JWT token against the Akash JWT schema
   * @param token The JWT token to validate
   * @returns Validation result with errors if any
   */
  validateToken(token: string | JWTPayload): JwtValidationResult {
    const result: JwtValidationResult = {
      isValid: false,
      errors: []
    };

    try {
      let payload: Record<string, any>;

      if (typeof token === "string") {
        // Split token into parts
        const parts = token.split(".");
        if (parts.length !== 3) {
          result.errors.push("Error validating token: Invalid token format");
          return result;
        }

        const [headerB64, payloadB64, signature] = parts;

        // Decode header and payload
        const header = this.base64Decode(headerB64);
        payload = this.base64Decode(payloadB64);

        result.decodedToken = {
          header,
          payload,
          signature
        };

        // Validate header
        if (!header.alg) {
          result.errors.push("Missing required field in header: alg");
          return result;
        }
      } else {
        payload = token;
      }

      // Use the schema directly from jwtSchemaData
      const validate = this.ajv.compile(jwtSchemaData);
      let valid = validate(payload);

      if (!valid) {
        result.errors =
          validate.errors?.map(error => {
            if (error.keyword === "required") {
              return `Missing required field: ${error.params.missingProperty}`;
            }
            if (error.keyword === "pattern") {
              return `Invalid format: ${error.instancePath.slice(1)} does not match pattern "${error.params.pattern}"`;
            }
            if (error.keyword === "additionalProperties") {
              return "Additional properties are not allowed";
            }
            return `${error.instancePath.slice(1)} ${error.message}`;
          }) || [];
      }

      // Additional validation for granular access
      if (payload.leases?.access === "granular") {
        if (!payload.leases?.permissions) {
          result.errors.push("Missing required field: permissions");
          valid = false;
        } else {
          // Check for duplicate providers
          const providers = new Set<string>();
          for (const perm of payload.leases.permissions) {
            if (providers.has(perm.provider)) {
              result.errors.push("Duplicate provider in permissions");
              valid = false;
              break;
            }
            providers.add(perm.provider);

            // Check for duplicate scopes within each permission
            const scopes = new Set<string>();
            for (const scope of perm.scope) {
              if (scopes.has(scope)) {
                result.errors.push("Duplicate scope in permission");
                valid = false;
                break;
              }
              scopes.add(scope);
            }

            // Check for duplicate services within each permission
            if (perm.services) {
              const services = new Set<string>();
              for (const service of perm.services) {
                if (services.has(service)) {
                  result.errors.push("Duplicate service in permission");
                  valid = false;
                  break;
                }
                services.add(service);
              }
            }
          }
        }
      }

      result.isValid = result.errors.length === 0;
    } catch (error) {
      result.errors.push(`Error validating token: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Decode a base64 string
   * @param base64String The base64 string to decode
   * @returns The decoded object
   */
  private base64Decode(base64String: string): Record<string, any> {
    const decoded = Buffer.from(base64String, "base64").toString("utf8");
    return JSON.parse(decoded);
  }
}
