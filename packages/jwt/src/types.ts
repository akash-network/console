export type AccessScope = "send-manifest" | "get-manifest" | "logs" | "shell" | "events" | "status" | "restart" | "hostname-migrate" | "ip-migrate";

export interface JwtTokenPayload {
  /** Version of the JWT specification (currently fixed at v1). */
  version: "v1";
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
  /** Access level for the lease: 'full' for unrestricted access to all actions, 'granular' for provider-specific permissions. */
  leases: FullAccess | GranularAccess;
}

interface FullAccess {
  access: "full";
  /** Global list of permitted actions across all owned leases (no duplicates). */
  scope?: AccessScope[];
}

interface GranularAccess {
  access: "granular";
  /** Defines provider-specific permissions. */
  permissions: LeasePermission[];
}

export interface JWTHeader {
  alg: string;
  typ: string;
}

export type LeasePermission = FullAccessPermission | ScopedAccessPermission | GranularAccessPermission;

interface BaseLeasePermission {
  /** Provider address, e.g., akash1xyz... (44 characters). */
  provider: string;
}

interface FullAccessPermission extends BaseLeasePermission {
  access: "full";
}

interface ScopedAccessPermission extends BaseLeasePermission {
  access: "scoped";
  scope: AccessScope[];
}

interface GranularAccessPermission extends BaseLeasePermission {
  access: "granular";
  deployments: Array<{
    /** Deployment sequence number. */
    dseq: number;
    /** Deployment-level list of permitted actions (no duplicates). */
    scope: AccessScope[];
    /** Group sequence number (requires dseq). */
    gseq?: number;
    /** Order sequence number (requires dseq and gseq). */
    oseq?: number;
    /** List of service names (requires dseq). */
    services?: string[];
  }>;
}
