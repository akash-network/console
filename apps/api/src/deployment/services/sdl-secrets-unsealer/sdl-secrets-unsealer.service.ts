import createError from "http-errors";
import { createHash } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { SDL_SECRETS_CONTENT_ENCRYPTION, SDL_SECRETS_MAX_SEAL_LIFETIME_MS, SDL_SECRETS_SEAL_ALGORITHM } from "@src/deployment/config/sdl-secrets.config";
import type { SdlSecretsKmsTarget } from "@src/deployment/providers/kms.provider";
import { SDL_SECRETS_KMS_TARGET } from "@src/deployment/providers/kms.provider";
import type { KmsWrappedJweFailure, ParsedKmsWrappedJwe } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import { KmsWrappedJweError, KmsWrappedJweService } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";

export type SdlSecrets = Record<string, string>;

interface SealHeader {
  alg?: unknown;
  enc?: unknown;
  kid?: unknown;
  sub?: unknown;
  exp?: unknown;
  sdlHash?: unknown;
}

interface SealRejection {
  status: number;
  event: string;
  message: string;
  isServiceFault?: true;
}

/** How a hostile or stale client input is reported: every shape failure blames the caller, and only an unreachable key service is our fault. */
const SEAL_REJECTIONS: Record<KmsWrappedJweFailure, SealRejection> = {
  MALFORMED: { status: 400, event: "SDL_SECRETS_SEAL_MALFORMED", message: "Sealed secrets must be a compact JWE" },
  HEADER_UNREADABLE: { status: 400, event: "SDL_SECRETS_SEAL_HEADER_UNREADABLE", message: "Sealed secrets carry an unreadable protected header" },
  ENCRYPTED_KEY_INVALID: { status: 400, event: "SDL_SECRETS_SEAL_ENCRYPTED_KEY_INVALID", message: "Sealed secrets carry a malformed encrypted key" },
  CIPHERTEXT_INVALID: { status: 400, event: "SDL_SECRETS_SEAL_CIPHERTEXT_INVALID", message: "Sealed secrets carry a malformed ciphertext" },
  IV_INVALID: { status: 400, event: "SDL_SECRETS_SEAL_IV_INVALID", message: "Sealed secrets carry a malformed initialization vector" },
  TAG_INVALID: { status: 400, event: "SDL_SECRETS_SEAL_TAG_INVALID", message: "Sealed secrets carry a malformed authentication tag" },
  ENCRYPTED_KEY_REJECTED: {
    status: 400,
    event: "SDL_SECRETS_SEAL_ENCRYPTED_KEY_REJECTED",
    message: "Sealed secrets carry an encrypted key this key version cannot open"
  },
  KEY_SERVICE_REQUEST_CORRUPTED: { status: 503, event: "SDL_SECRETS_CEK_REQUEST_CORRUPTED", message: "SDL secrets could not be unsealed" },
  KEY_SERVICE_PLAINTEXT_MISSING: { status: 503, event: "SDL_SECRETS_CEK_MISSING", message: "SDL secrets could not be unsealed" },
  KEY_SERVICE_RESPONSE_CORRUPTED: { status: 503, event: "SDL_SECRETS_CEK_RESPONSE_CORRUPTED", message: "SDL secrets could not be unsealed" },
  KEY_SERVICE_UNREACHABLE: {
    status: 503,
    event: "SDL_SECRETS_CEK_UNWRAP_FAILED",
    message: "Unable to reach the SDL secrets key management service",
    isServiceFault: true
  },
  AUTHENTICATION_FAILED: { status: 400, event: "SDL_SECRETS_SEAL_TAMPERED", message: "Sealed secrets failed authentication" }
};

function isSdlBound(header: SealHeader) {
  return header.sdlHash !== undefined;
}

/** Holds only what makes a seal a seal — the claims a client must prove and the flat string payload — because the wire format lives in `KmsWrappedJweService`. */
@singleton()
export class SdlSecretsUnsealerService {
  readonly #loggerService: ReturnType<CreateLogger>;

  constructor(
    @inject(SDL_SECRETS_KMS_TARGET) private readonly kmsTarget: SdlSecretsKmsTarget,
    private readonly wrappedJweService: KmsWrappedJweService,
    private readonly authService: AuthService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#loggerService = createLogger({ context: SdlSecretsUnsealerService.name });
  }

  async open({ seal, sdl }: { seal: string; sdl: string }): Promise<SdlSecrets> {
    const parsed = this.#parseSeal(seal);
    const header = this.#validateHeader(parsed.header);
    this.#assertSdlBinding(header, sdl);

    const secrets = this.#parseSecrets(await this.#openSeal(parsed));

    this.#loggerService.info({
      event: "SDL_SECRETS_SEAL_OPENED",
      kid: this.kmsTarget.kid,
      secretCount: Object.keys(secrets).length,
      sdlBound: isSdlBound(header)
    });

    return secrets;
  }

  #parseSeal(seal: string): ParsedKmsWrappedJwe {
    try {
      return this.wrappedJweService.parse(seal);
    } catch (error) {
      throw this.#rejectWrappedJweFailure(error);
    }
  }

  async #openSeal(parsed: ParsedKmsWrappedJwe): Promise<Buffer> {
    try {
      return await this.wrappedJweService.open(parsed);
    } catch (error) {
      throw this.#rejectWrappedJweFailure(error);
    }
  }

  #rejectWrappedJweFailure(error: unknown) {
    if (!(error instanceof KmsWrappedJweError)) return error;

    const { status, event, message, isServiceFault } = SEAL_REJECTIONS[error.failure];

    if (isServiceFault) {
      this.#loggerService.error({ event, ...error.details });

      return createError(status, message);
    }

    return this.#reject(status, event, message, error.details);
  }

  /** Everything here is free; nothing below it is. A malformed or stale seal must never reach Cloud KMS. */
  #validateHeader(header: SealHeader) {
    if (header.alg !== SDL_SECRETS_SEAL_ALGORITHM || header.enc !== SDL_SECRETS_CONTENT_ENCRYPTION) {
      throw this.#reject(400, "SDL_SECRETS_SEAL_ALGORITHM_UNSUPPORTED", `Seals must use ${SDL_SECRETS_SEAL_ALGORITHM} and ${SDL_SECRETS_CONTENT_ENCRYPTION}`, {
        alg: header.alg,
        enc: header.enc
      });
    }

    if (header.kid !== this.kmsTarget.kid) {
      throw this.#reject(409, "SDL_SECRETS_SEAL_KID_UNKNOWN", "Sealed to a key the console no longer holds; refetch the SDL secrets context", {
        received: header.kid,
        expected: this.kmsTarget.kid
      });
    }

    if (header.sub !== this.authService.currentUser.id) {
      throw this.#reject(403, "SDL_SECRETS_SEAL_SUBJECT_MISMATCH", "Sealed for a different user", { received: header.sub });
    }

    const now = Date.now();

    if (typeof header.exp !== "number" || header.exp * 1000 <= now) {
      throw this.#reject(400, "SDL_SECRETS_SEAL_EXPIRED", "Sealed secrets have expired", { exp: header.exp });
    }

    if (header.exp * 1000 > now + SDL_SECRETS_MAX_SEAL_LIFETIME_MS) {
      throw this.#reject(400, "SDL_SECRETS_SEAL_LIFETIME_TOO_LONG", "Sealed secrets expire too far in the future", {
        exp: header.exp,
        maxLifetimeMs: SDL_SECRETS_MAX_SEAL_LIFETIME_MS
      });
    }

    return header;
  }

  /**
   * `sub` binds a seal to a user; `sdlHash` binds it to a deployment, closing the gap where an
   * intermediary forwards the seal and the credentials untouched while swapping the SDL for one it
   * controls. The claim is optional on the wire but authenticated by the GCM tag, so it cannot be
   * stripped from a seal that carries one — optionality weakens only clients that chose not to send it.
   *
   * The digest is over the `sdl` string exactly as it arrived, never over a parsed-then-re-serialized
   * SDL: re-serializing reorders keys and rewrites whitespace, producing mismatches that are painful
   * to debug. JSON string values round-trip byte-exact, so no raw-body access is needed.
   */
  #assertSdlBinding(header: SealHeader, sdl: string) {
    if (!isSdlBound(header)) return;

    if (header.sdlHash !== createHash("sha256").update(sdl, "utf8").digest("base64url")) {
      throw this.#reject(403, "SDL_SECRETS_SEAL_SDL_MISMATCH", "Sealed secrets are bound to a different SDL", { received: header.sdlHash });
    }
  }

  #parseSecrets(plaintext: Buffer): SdlSecrets {
    const secrets = this.#decodeSecretsJson(plaintext);

    if (!secrets || typeof secrets !== "object" || Array.isArray(secrets) || Object.values(secrets).some(value => typeof value !== "string")) {
      throw this.#reject(400, "SDL_SECRETS_SEAL_PAYLOAD_INVALID", "Sealed secrets must be a flat object of string values", {});
    }

    return secrets as SdlSecrets;
  }

  #decodeSecretsJson(plaintext: Buffer): unknown {
    try {
      return JSON.parse(plaintext.toString("utf8"));
    } catch {
      return null;
    }
  }

  #reject(status: number, event: string, message: string, details: Record<string, unknown>) {
    this.#loggerService.warn({ event, ...details });

    return createError(status, message);
  }
}
