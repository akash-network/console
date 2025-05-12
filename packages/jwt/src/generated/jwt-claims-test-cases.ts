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
    description: "sign valid/verify against static token string",
    tokenString:
      "eyJhbGciOiJFUzI1NksiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJha2FzaDFxdWZhM3h6cmYzNHF2d3llamtodm5jNHBzZjQ5ZmZ0YXcwYXNtaCIsImV4cCI6MjA0NjY2NzEwMywiaWF0IjoxNzQ2NjY2MTAzLCJ2ZXJzaW9uIjoidjEiLCJsZWFzZXMiOnsiYWNjZXNzIjoiZnVsbCJ9fQ.HHeMUBJplkyQdkG6IgJtPxFyhyIG8EvcjW7k8btrYJxW_3mr5j-ZPQbjKbOkcXx75xm4pT_wEBeR6W39Ekcqng",
    claims: {
      iss: "akash1qufa3xzrf34qvwyejkhvnc4psf49fftaw0asmh",
      iat: "1746666103",
      exp: "2046667103",
      version: "v1",
      leases: {
        access: "full"
      }
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: false
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
    description: "sign valid/verify fail granular access/specific provider/missing access",
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
    description: "sign valid/verify pass/specific provider/full access",
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
            access: "full"
          }
        ]
      }
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: false
    }
  },
  {
    description: "sign valid/verify fail/specific provider/scoped access",
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
            access: "scoped"
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
    description: "sign valid/verify pass/specific provider/scoped access",
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
            access: "scoped",
            scope: ["send-manifest"]
          }
        ]
      }
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: false
    }
  },
  {
    description: "sign valid/verify fail/specific provider/scoped access/duplicate",
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
            access: "scoped",
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
    description: "sign valid/verify fail/specific provider/granular access with scope",
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
            access: "granular",
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
            access: "scoped",
            scope: ["send-manifest"]
          },
          {
            provider: "{{.Provider}}",
            access: "scoped",
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
            access: "scoped",
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
    description: "sign valid/verify fail granular access/specific provider/deployment/missing scope",
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
            access: "granular",
            deployments: [
              {
                services: ["web"]
              }
            ]
          }
        ]
      }
    },
    expected: {
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify fail granular access/specific provider/deployment/duplicate scope",
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
            access: "granular",
            deployments: [
              {
                scope: ["send-manifest", "send-manifest"]
              }
            ]
          }
        ]
      }
    },
    expected: {
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify fail granular access/specific provider/deployment/invalid scope",
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
            access: "granular",
            deployments: [
              {
                scope: ["unknown"]
              }
            ]
          }
        ]
      }
    },
    expected: {
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify fail granular access/specific provider/deployment/missing dseq",
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
            access: "granular",
            deployments: [
              {
                scope: ["send-manifest"]
              }
            ]
          }
        ]
      }
    },
    expected: {
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify fail granular access/specific provider/deployment/no services",
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
            access: "granular",
            deployments: [
              {
                scope: ["send-manifest"],
                dseq: 1
              }
            ]
          }
        ]
      }
    },
    expected: {
      signFail: false,
      verifyFail: true
    }
  },
  {
    description: "sign valid/verify pass granular access/specific provider/deployment",
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
            access: "granular",
            deployments: [
              {
                scope: ["send-manifest"],
                dseq: 1,
                services: ["web"]
              }
            ]
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
    description: "sign valid/verify fail granular access/specific provider/deployment/duplicate service",
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
            access: "granular",
            deployments: [
              {
                scope: ["send-manifest"],
                dseq: 1,
                services: ["web", "web"]
              }
            ]
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
    description: "sign valid/verify fail granular access/specific provider/deployment/oseq",
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
            access: "granular",
            deployments: [
              {
                scope: ["send-manifest"],
                dseq: 1,
                oseq: 1,
                services: ["web", "web"]
              }
            ]
          }
        ]
      }
    },
    expected: {
      error: "token has invalid claims",
      signFail: false,
      verifyFail: true
    }
  }
];
