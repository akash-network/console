import { LoggerService } from "@akashnetwork/logging";
import crypto from "crypto";
import type { Context, Next } from "hono";
import { Forbidden, Unauthorized } from "http-errors";
import jwt from "jsonwebtoken";
import { LRUCache } from "lru-cache";
import { inject, singleton } from "tsyringe";

import { ADMIN_CONFIG, type AdminConfig } from "@src/core/providers/config.provider";

interface JwtPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
}

interface AdminUser {
  sub: string;
  email: string;
  emailVerified: boolean;
}

interface JWK {
  kid: string;
  kty: string;
  use?: string;
  n?: string;
  e?: string;
  x5c?: string[];
}

@singleton()
export class AdminAuthInterceptor {
  private readonly logger = LoggerService.forContext(AdminAuthInterceptor.name);
  private readonly jwksCache = new LRUCache<string, string>({
    max: 100,
    ttl: 1000 * 60 * 60 // 1 hour
  });

  private readonly allowedDomains: string[];
  private readonly whitelistEmails: string[];

  constructor(@inject(ADMIN_CONFIG) private readonly config: AdminConfig) {
    this.allowedDomains = this.config.ADMIN_ALLOWED_DOMAINS.split(",").map(d => d.trim().toLowerCase());
    this.whitelistEmails = this.config.ADMIN_WHITELIST_EMAILS ? this.config.ADMIN_WHITELIST_EMAILS.split(",").map(e => e.trim().toLowerCase()) : [];
  }

  intercept() {
    return async (c: Context, next: Next) => {
      const authHeader = c.req.header("authorization");

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new Unauthorized("Missing or invalid authorization header");
      }

      const token = authHeader.substring(7);

      try {
        const decoded = await this.verifyToken(token);
        const email = decoded.email?.toLowerCase();

        if (!email) {
          throw new Forbidden("Email not found in token");
        }

        if (!this.isAuthorized(email)) {
          this.logger.warn({ event: "UNAUTHORIZED_ACCESS_ATTEMPT", email });
          throw new Forbidden("Access denied. You are not authorized to access this resource.");
        }

        const adminUser: AdminUser = {
          sub: decoded.sub,
          email: email,
          emailVerified: decoded.email_verified ?? false
        };

        c.set("adminUser", adminUser);
        this.logger.debug({ event: "ADMIN_AUTH_SUCCESS", email });

        return await next();
      } catch (error) {
        if (error instanceof Forbidden || error instanceof Unauthorized) {
          throw error;
        }
        this.logger.error({ event: "ADMIN_AUTH_ERROR", error });
        throw new Unauthorized("Invalid or expired token");
      }
    };
  }

  private async verifyToken(token: string): Promise<JwtPayload> {
    // Decode without verification first to get the header
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      throw new Unauthorized("Invalid token format");
    }

    const kid = decoded.header.kid;
    const signingKey = await this.getSigningKey(kid);

    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        signingKey,
        {
          issuer: this.config.AUTH0_ISSUER,
          audience: this.config.AUTH0_AUDIENCE
        },
        (err, payload) => {
          if (err) {
            reject(err);
          } else {
            resolve(payload as JwtPayload);
          }
        }
      );
    });
  }

  private async getSigningKey(kid: string | undefined): Promise<string> {
    if (!kid) {
      throw new Unauthorized("Token missing key ID");
    }

    const cachedKey = this.jwksCache.get(kid);
    if (cachedKey) {
      return cachedKey;
    }

    const response = await fetch(this.config.AUTH0_JWKS_URI);
    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
    }

    const jwks: { keys?: JWK[] } = await response.json();
    const key = jwks.keys?.find((k: JWK) => k.kid === kid);

    if (!key) {
      throw new Unauthorized("Signing key not found");
    }

    // Convert JWK to PEM format
    const pem = this.jwkToPem(key);
    this.jwksCache.set(kid, pem);

    return pem;
  }

  private jwkToPem(jwk: JWK): string {
    // For RS256, we need to convert the JWK to PEM format
    // The x5c array contains the certificate chain
    if (jwk.x5c && jwk.x5c.length > 0) {
      return `-----BEGIN CERTIFICATE-----\n${jwk.x5c[0]}\n-----END CERTIFICATE-----`;
    }

    // If no x5c, try to construct from n and e (RSA public key components)
    if (jwk.n && jwk.e) {
      const keyObject = crypto.createPublicKey({ key: jwk, format: "jwk" });
      return keyObject.export({ type: "spki", format: "pem" }) as string;
    }

    throw new Error("Unable to extract public key from JWK");
  }

  private isAuthorized(email: string): boolean {
    // Check if email is in whitelist
    if (this.whitelistEmails.includes(email)) {
      return true;
    }

    // Check if email domain is allowed
    const emailDomain = email.split("@")[1];
    if (emailDomain && this.allowedDomains.includes(emailDomain)) {
      return true;
    }

    return false;
  }
}
