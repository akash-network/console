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
      description: "Token issuance timestamp as Unix time (seconds since 1970-01-01T00:00:00Z). Should be <= exp and >= nbf."
    },
    nbf: {
      type: "integer",
      minimum: 0,
      description: "Not valid before timestamp as Unix time (seconds since 1970-01-01T00:00:00Z). Should be <= iat."
    },
    exp: {
      type: "integer",
      minimum: 0,
      description: "Expiration timestamp as Unix time (seconds since 1970-01-01T00:00:00Z). Should be >= iat."
    },
    jti: {
      type: "string",
      minLength: 1,
      description: "Unique identifier for the JWT, used to prevent token reuse."
    },
    version: {
      type: "string",
      enum: ["v1"],
      description: "Version of the JWT specification (currently fixed at v1)."
    },
    leases: {
      type: "object",
      additionalProperties: false,
      required: ["access"],
      properties: {
        access: {
          type: "string",
          enum: ["full", "granular"],
          description: "Access level for the lease: 'full' for unrestricted access to all actions, 'granular' for provider-specific permissions."
        },
        scope: {
          type: "array",
          minItems: 1,
          uniqueItems: true,
          items: {
            type: "string",
            enum: ["send-manifest", "get-manifest", "logs", "shell", "events", "status", "restart", "hostname-migrate", "ip-migrate"]
          },
          description: "Global list of permitted actions across all owned leases (no duplicates). Optional when access is 'full'."
        },
        permissions: {
          type: "array",
          description:
            "Required if leases.access is 'granular'; defines provider-specific permissions. The provider address must be unique across all permissions entries.",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["provider", "access"],
            properties: {
              provider: {
                type: "string",
                pattern: "^akash1[a-z0-9]{38}$",
                description: "Provider address, e.g., akash1xyz... (44 characters)."
              },
              access: {
                type: "string",
                enum: ["full", "scoped", "granular"],
                description:
                  "Provider-level access: 'full' for all actions, 'scoped' for specific actions across all provider leases, 'granular' for deployment-specific actions."
              },
              scope: {
                type: "array",
                minItems: 1,
                uniqueItems: true,
                items: {
                  type: "string",
                  enum: ["send-manifest", "get-manifest", "logs", "shell", "events", "status", "restart", "hostname-migrate", "ip-migrate"]
                },
                description: "Provider-level list of permitted actions for 'scoped' access (no duplicates)."
              },
              deployments: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["dseq", "scope", "services"],
                  properties: {
                    dseq: {
                      type: "integer",
                      minimum: 1,
                      description: "Deployment sequence number."
                    },
                    scope: {
                      type: "array",
                      minItems: 1,
                      uniqueItems: true,
                      items: {
                        type: "string",
                        enum: ["send-manifest", "get-manifest", "logs", "shell", "events", "status", "restart", "hostname-migrate", "ip-migrate"]
                      },
                      description: "Deployment-level list of permitted actions (no duplicates)."
                    },
                    gseq: {
                      type: "integer",
                      minimum: 0,
                      description: "Group sequence number (requires dseq)."
                    },
                    oseq: {
                      type: "integer",
                      minimum: 0,
                      description: "Order sequence number (requires dseq and gseq)."
                    },
                    services: {
                      type: "array",
                      minItems: 1,
                      items: {
                        type: "string",
                        minLength: 1
                      },
                      description: "List of service names (requires dseq)."
                    }
                  },
                  dependencies: {
                    gseq: ["dseq"],
                    oseq: ["dseq", "gseq"],
                    services: ["dseq"]
                  }
                }
              }
            },
            allOf: [
              {
                if: {
                  properties: {
                    access: {
                      const: "scoped"
                    }
                  }
                },
                then: {
                  required: ["scope"],
                  properties: {
                    scope: {
                      minItems: 1
                    },
                    deployments: false
                  }
                }
              },
              {
                if: {
                  properties: {
                    access: {
                      const: "granular"
                    }
                  }
                },
                then: {
                  required: ["deployments"],
                  properties: {
                    scope: false
                  }
                }
              },
              {
                if: {
                  properties: {
                    access: {
                      const: "full"
                    }
                  }
                },
                then: {
                  properties: {
                    scope: false,
                    deployments: false
                  }
                }
              }
            ]
          }
        }
      },
      allOf: [
        {
          if: {
            properties: {
              access: {
                const: "full"
              }
            }
          },
          then: {
            properties: {
              permissions: false
            }
          }
        },
        {
          if: {
            properties: {
              access: {
                const: "granular"
              }
            },
            required: ["access"]
          },
          then: {
            required: ["permissions"],
            properties: {
              scope: false
            }
          }
        }
      ]
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
            required: ["permissions"],
            properties: {
              scope: false
            }
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
