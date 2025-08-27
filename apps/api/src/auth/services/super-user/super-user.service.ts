import { singleton } from "tsyringe";

import { LoggerService } from "@src/core/providers/logging.provider";

export interface SuperUserMetadata {
  roles?: string[];
}

const SAFE_METADATA_FIELDS = new Set(["roles"]);

@singleton()
export class SuperUserService {
  private readonly logger = LoggerService.forContext(SuperUserService.name);

  constructor() {
    this.logger.info({
      event: "SUPER_USER_SERVICE_INITIALIZED"
    });
  }

  /**
   * Sanitize metadata to only include safe fields
   */
  sanitizeMetadata(metadata?: Record<string, any>): SuperUserMetadata | undefined {
    if (!metadata) return undefined;

    const sanitized: SuperUserMetadata = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (SAFE_METADATA_FIELDS.has(key)) {
        sanitized[key as keyof SuperUserMetadata] = value;
      }
    }

    const filteredKeys = Object.keys(metadata).filter(key => !SAFE_METADATA_FIELDS.has(key));
    if (filteredKeys.length > 0) {
      this.logger.info({
        event: "METADATA_SANITIZED",
        filteredKeys,
        sanitizedKeys: Object.keys(sanitized)
      });
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  /**
   * Check if a user ID is a super user (deprecated - use hasSuperUserRole instead)
   */
  isSuperUser(userId: string): boolean {
    this.logger.warn({
      event: "DEPRECATED_METHOD_CALLED",
      method: "isSuperUser",
      userId
    });
    return false;
  }

  /**
   * Check if user has super user role from Auth0 roles
   */
  hasSuperUserRole(metadata?: SuperUserMetadata, roles?: string[]): boolean {
    // Check Auth0 roles from metadata (from JWT token)
    if (metadata?.roles?.includes("SUPER_USER")) {
      return true;
    }

    // Check roles parameter (if passed separately)
    if (roles?.includes("SUPER_USER")) {
      return true;
    }

    return false;
  }

  /**
   * Validate super user access with comprehensive checks
   */
  validateSuperUserAccess(userId: string, metadata?: SuperUserMetadata, roles?: string[]): boolean {
    if (!this.hasSuperUserRole(metadata, roles)) {
      return false;
    }

    this.logger.info({
      event: "SUPER_USER_ACCESS_GRANTED",
      userId
    });

    return true;
  }

  /**
   * Get super user statistics for monitoring
   */
  getSuperUserStats(): {
    totalSuperUsers: number;
  } {
    return {
      totalSuperUsers: 0 // No longer tracking via environment variables
    };
  }
}
