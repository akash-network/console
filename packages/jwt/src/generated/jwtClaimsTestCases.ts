// This file contains test cases for JWT claims validation
export const jwtClaimsTestCases = [
  {
    description: "sign valid/verify fail with invalid issuer",
    tokenString:
      "eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ.eyJ2ZXJzaW9uIjoiIiwibGVhc2VzIjp7ImFjY2VzcyI6IiJ9fQ.fQFwGyhJDyF9i_zCX6IwJ43_arjs_1qJmxNSph6t8INMMZ7hBvrzwg0Ym8N06G7O_ZDw0mujQCfmOmR1jegnmA",
    claims: {},
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify fail with empty iat",
    tokenString:
      "eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJha2FzaDFxdWZhM3h6cmYzNHF2d3llamtodm5jNHBzZjQ5ZmZ0YXcwYXNtaCIsInZlcnNpb24iOiIiLCJsZWFzZXMiOnsiYWNjZXNzIjoiIn19.xJmyqk4-2LXPa_l3wQdZhDSsTUatYO8SxBSr_D7_uust0LOFLUqdwIAAX8jpFoWTbbgWN0cQhPNOcBrI3-P9XQ",
    claims: {
      iss: "{{.Issuer}}"
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify fail with invalid exp",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}"
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify fail with invalid version",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}"
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify fail with invalid access type",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1"
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify fail with invalid access type/2",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "unknown"
      }
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify valid full access",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "full"
      }
    },
    expected: {
      signFail: false,
      verifyFail: false
    }
  },
  {
    description: "sign valid/verify fail granular access",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "granular"
      }
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify fail granular access/specific provider/missing scope",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "granular",
        permissions: [
          {
            provider: "{{.Provider}}"
          }
        ]
      }
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify pass granular access/specific provider/scope",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "granular",
        permissions: [
          {
            provider: "{{.Provider}}",
            scope: ["send-manifest"]
          }
        ]
      }
    },
    expected: {
      signFail: false,
      verifyFail: false
    }
  },
  {
    description: "sign valid/verify fail granular access/duplicate provider",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "granular",
        permissions: [
          {
            provider: "{{.Provider}}",
            scope: ["send-manifest"]
          },
          {
            provider: "{{.Provider}}",
            scope: ["send-manifest"]
          }
        ]
      }
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify fail granular access/specific provider/duplicate scope",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "granular",
        permissions: [
          {
            provider: "{{.Provider}}",
            scope: ["send-manifest", "send-manifest"]
          }
        ]
      }
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify fail granular access/specific provider/unknown scope",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "granular",
        permissions: [
          {
            provider: "{{.Provider}}",
            scope: ["unknown"]
          }
        ]
      }
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify pass granular access/specific provider/service",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "granular",
        permissions: [
          {
            provider: "{{.Provider}}",
            scope: ["send-manifest"],
            services: ["web"]
          }
        ]
      }
    },
    expected: {
      signFail: false,
      verifyFail: false
    }
  },
  {
    description: "sign valid/verify fail granular access/specific provider/service",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "granular",
        permissions: [
          {
            provider: "{{.Provider}}",
            scope: ["send-manifest"],
            services: ["web", "web"]
          }
        ]
      }
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify pass granular access/dseq",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "granular",
        permissions: [
          {
            provider: "{{.Provider}}",
            scope: ["send-manifest"],
            dseq: 1
          }
        ]
      }
    },
    expected: {
      signFail: false,
      verifyFail: false
    }
  },
  {
    description: "sign valid/verify fail granular access/gseq",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "granular",
        permissions: [
          {
            provider: "{{.Provider}}",
            scope: ["send-manifest"],
            gseq: 1
          }
        ]
      }
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify fail granular access/oseq",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "granular",
        permissions: [
          {
            provider: "{{.Provider}}",
            scope: ["send-manifest"],
            oseq: 1
          }
        ]
      }
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify fail granular access/dseq/oseq",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "granular",
        permissions: [
          {
            provider: "{{.Provider}}",
            scope: ["send-manifest"],
            dseq: 1,
            oseq: 1
          }
        ]
      }
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify pass granular access/dseq/gseq/oseq",
    claims: {
      iss: "{{.Issuer}}",
      iat: "{{.Iat24h}}",
      exp: "{{.Exp48h}}",
      version: "v1",
      leases: {
        access: "granular",
        permissions: [
          {
            provider: "{{.Provider}}",
            scope: ["send-manifest"],
            dseq: 1,
            gseq: 1,
            oseq: 1
          }
        ]
      }
    },
    expected: {
      signFail: false,
      verifyFail: false
    }
  }
];
