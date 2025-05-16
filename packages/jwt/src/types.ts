export type Scope = "send-manifest" | "get-manifest" | "logs" | "shell" | "events" | "status" | "restart" | "hostname-migrate" | "ip-migrate";
export type Access = "full" | "granular" | "scoped";

export interface JwtTokenOptions {
  /** Akash address of the lease(s) owner, e.g., akash1abcd... (44 characters) */
  iss: string;
  /** Token issuance timestamp as Unix time (seconds since 1970-01-01T00:00:00Z). Should be <= exp and >= nbf. */
  iat: number;
  /** Not valid before timestamp as Unix time (seconds since 1970-01-01T00:00:00Z). Should be <= iat. */
  nbf: number;
  /** Expiration timestamp as Unix time (seconds since 1970-01-01T00:00:00Z). Should be >= iat. */
  exp: number;
  /** Unique identifier for the JWT, used to prevent token reuse. */
  jti?: string;
  /** Version of the JWT specification (currently fixed at v1). */
  version: "v1";
  /** Access control configuration for leases */
  leases: {
    /** Access level for the lease: 'full' for unrestricted access to all actions, 'granular' for provider-specific permissions. */
    access: Access;
    /** Global list of permitted actions across all owned leases (no duplicates). Applies when access is 'full'. */
    scope?: Scope[];
    /** Required if leases.access is 'granular'; defines provider-specific permissions. */
    permissions?: Array<{
      /** Provider address, e.g., akash1xyz... (44 characters). */
      provider: string;
      /** Provider-level access: 'full' for all actions, 'scoped' for specific actions across all provider leases, 'granular' for deployment-specific actions. */
      access: Access;
      /** Provider-level list of permitted actions for 'scoped' access (no duplicates). */
      scope?: Scope[];
      /** Deployment-specific permissions for 'granular' access. */
      deployments?: Array<{
        /** Deployment sequence number. */
        dseq: number;
        /** Deployment-level list of permitted actions (no duplicates). */
        scope: Scope[];
        /** Group sequence number (requires dseq). */
        gseq?: number;
        /** Order sequence number (requires dseq and gseq). */
        oseq?: number;
        /** List of service names (requires dseq). */
        services?: Array<string>;
      }>;
    }>;
  };
}

export interface JWTHeader {
  alg: string;
  typ: string;
}

export interface Permission {
  provider: string;
  access: Access;
  scope?: Scope[];
  deployments?: Array<{
    dseq: number;
    scope: Scope[];
    gseq?: number;
    oseq?: number;
    services?: Array<string>;
  }>;
}

export interface Leases {
  access: Access;
  scope?: Scope[];
  permissions?: Permission[];
}

export interface JWTPayload {
  iss: string;
  iat?: number;
  nbf?: number;
  exp?: number;
  jti?: string;
  version?: "v1";
  leases: Leases;
}
