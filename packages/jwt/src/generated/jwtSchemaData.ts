export const jwtSchemaData = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://raw.githubusercontent.com/akash-network/akash-api/refs/heads/main/specs/jwt-schema.json",
  title: "Akash JWT Schema",
  description: "JSON Schema for JWT used in the Akash Provider API.",
  type: "object",
  additionalProperties: false,
  required: ["iss", "iat", "exp", "nbf", "version", "leases"],
  properties: {
    iss: {
      type: "string",
      pattern: "^akash1[a-z0-9]{38}$",
      description: "Akash address of the lease(s) owner, e.g., akash1abcd... (44 characters)"
    },
    iat: {
      type: "integer",
      minimum: 0,
      description: "Token issuance timestamp as Unix time (seconds since 1970-01-01T00:00:00Z)"
    },
    nbf: {
      type: "integer",
      minimum: 0,
      description: "Not valid before timestamp as Unix time (seconds since 1970-01-01T00:00:00Z)"
    },
    exp: {
      type: "integer",
      minimum: 0,
      description: "Expiration timestamp as Unix time (seconds since 1970-01-01T00:00:00Z)"
    },
    jti: {
      type: "string",
      description: "The jti (JWT ID) claim provides a unique identifier for the JWT"
    },
    version: {
      type: "string",
      enum: ["v1"],
      description: "Version of the JWT specification (currently fixed at v1)"
    },
    leases: {
      type: "object",
      additionalProperties: false,
      required: ["access"],
      properties: {
        access: {
          type: "string",
          enum: ["full", "granular"],
          description: "Access level of the token: 'full' for unrestricted, 'granular' for specific permissions"
        },
        permissions: {
          type: "array",
          description: "Required if access is 'granular'; defines specific permissions",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["provider", "scope"],
            properties: {
              provider: {
                type: "string",
                pattern: "^akash1[a-z0-9]{38}$",
                description: "Provider address, e.g., akash1xyz... (44 characters)"
              },
              scope: {
                type: "array",
                minItems: 1,
                uniqueItems: true,
                items: {
                  type: "string",
                  enum: ["send-manifest", "shell", "logs", "events", "restart"]
                },
                description: "List of permitted actions (no duplicates)"
              },
              dseq: {
                type: "integer",
                minimum: 1,
                description: "Optional deployment sequence number"
              },
              gseq: {
                type: "integer",
                minimum: 1,
                description: "Optional group sequence number (requires dseq)"
              },
              oseq: {
                type: "integer",
                minimum: 1,
                description: "Optional order sequence number (requires dseq)"
              },
              services: {
                type: "array",
                minItems: 1,
                items: {
                  type: "string",
                  minLength: 1
                },
                description: "Optional list of service names (requires dseq)"
              }
            },
            dependencies: {
              gseq: ["dseq"],
              oseq: ["dseq", "gseq"],
              services: ["dseq"]
            }
          }
        }
      }
    }
  },
  allOf: [
    {
      if: {
        properties: {
          leases: {
            properties: {
              access: {
                const: "granular"
              }
            },
            required: ["access"]
          }
        },
        required: ["leases"]
      },
      then: {
        properties: {
          leases: {
            required: ["permissions"]
          }
        }
      }
    },
    {
      if: {
        properties: {
          leases: {
            properties: {
              permissions: {
                type: "array",
                minItems: 1
              }
            },
            required: ["permissions"]
          }
        },
        required: ["leases"]
      },
      then: {
        properties: {
          leases: {
            properties: {
              access: {
                const: "granular"
              }
            },
            required: ["access"]
          }
        }
      }
    }
  ]
};
