import https from "node:https";
import type { Duplex } from "node:stream";
import type { TLSSocket } from "node:tls";

import type { CertificateValidator, CertValidationResultError } from "../CertificateValidator/CertificateValidator";

export type ProviderCertificateRejection = CertValidationResultError["code"] | "noCertificate" | "serverError";

export class ProviderCertificateRejectedError extends Error {
  readonly code: ProviderCertificateRejection;

  constructor(code: ProviderCertificateRejection, options?: ErrorOptions) {
    super(`Provider certificate rejected: ${code}`, options);
    this.name = "ProviderCertificateRejectedError";
    this.code = code;
  }
}

export interface ProviderCertificateAgentOptions extends https.AgentOptions {
  certificateValidator: CertificateValidator;
  providerAddress: string;
}

/** Holds back everything a request writes until the TLS peer's certificate passes, so a peer that fails it receives no header, body or upgrade request. */
export class ProviderCertificateAgent extends https.Agent {
  readonly #certificateValidator: CertificateValidator;
  readonly #providerAddress: string;
  readonly #verifiedSessions = new Map<string, Buffer>();
  readonly #verifying = new WeakSet<Duplex>();

  constructor({ certificateValidator, providerAddress, ...options }: ProviderCertificateAgentOptions) {
    super({ ...options, maxCachedSessions: 0 });
    this.#certificateValidator = certificateValidator;
    this.#providerAddress = providerAddress;
  }

  isVerifying(socket: Duplex | null | undefined): boolean {
    return !!socket && this.#verifying.has(socket);
  }

  createConnection(options: https.RequestOptions): Duplex {
    const sessionKey = this.getName(options);
    const connectionOptions: https.RequestOptions & { session?: Buffer } = { ...options, session: this.#verifiedSessions.get(sessionKey) };
    const socket = super.createConnection(connectionOptions) as TLSSocket;
    let latestSession: Buffer | undefined;
    let verified = false;

    socket.cork();
    socket.on("session", session => {
      latestSession = session;
      if (verified) this.#verifiedSessions.set(sessionKey, session);
    });
    socket.once("secureConnect", async () => {
      verified = await this.#verify(socket);
      if (verified && latestSession) this.#verifiedSessions.set(sessionKey, latestSession);
    });

    return socket;
  }

  async #verify(socket: TLSSocket): Promise<boolean> {
    this.#verifying.add(socket);

    try {
      const result = await verifyProviderCertificate(socket, this.#certificateValidator, this.#providerAddress);

      if (result.ok) {
        socket.uncork();
        return true;
      }

      socket.destroy(new ProviderCertificateRejectedError(result.code));
    } catch (error) {
      socket.destroy(new ProviderCertificateRejectedError("serverError", { cause: error }));
    } finally {
      this.#verifying.delete(socket);
    }

    return false;
  }
}

/** Only sessions whose full handshake passed are offered for resumption, so a resumed session, which carries no certificate, is already verified. */
export async function verifyProviderCertificate(
  socket: Pick<TLSSocket, "authorized" | "isSessionReused" | "getPeerX509Certificate">,
  certificateValidator: CertificateValidator,
  providerAddress: string
): Promise<{ ok: true } | { ok: false; code: ProviderCertificateRejection }> {
  if (socket.authorized || socket.isSessionReused()) return { ok: true };

  const certificate = socket.getPeerX509Certificate();
  if (!certificate) return { ok: false, code: "noCertificate" };

  return await certificateValidator.validate(certificate, providerAddress);
}
