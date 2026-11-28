import { JwtTokenManager, type JwtTokenPayload } from "@akashnetwork/chain-sdk";
import createError from "http-errors";
import { randomUUID } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { memoizeAsync } from "@src/caching/helpers/helpers";
import { TxManagerService } from "@src/services/tx-manager/tx-manager.service";

export type ProviderTokenRequest = { derivationIndex: number; seedVersion?: string; leases: JwtTokenPayload["leases"]; ttl: number };

/** Each remembered issuer keeps one derived private key in memory. */
const MAX_REMEMBERED_ISSUERS = 1_000;

/** Issues the token a provider accepts as proof of a user wallet, which only the holder of that wallet's key can sign. */
@singleton()
export class ProviderTokenService {
  readonly #getIssuer = memoizeAsync(
    async (derivationIndex: number, seedVersion: string | undefined) => {
      const wallet = this.txManagerService.getDerivedWallet(derivationIndex, seedVersion);

      return { jwtTokenManager: new JwtTokenManager(wallet), address: await wallet.getFirstAddress() };
    },
    { maxEntries: MAX_REMEMBERED_ISSUERS }
  );

  constructor(@inject(TxManagerService) private readonly txManagerService: TxManagerService) {}

  async issue({ derivationIndex, seedVersion, leases, ttl }: ProviderTokenRequest): Promise<string> {
    const { jwtTokenManager, address } = await this.#getIssuer(derivationIndex, seedVersion);
    const now = Math.floor(Date.now() / 1000);
    const payload: JwtTokenPayload = {
      version: "v1",
      exp: now + ttl,
      nbf: now,
      iat: now,
      iss: address,
      jti: randomUUID(),
      leases
    };
    const { errors } = jwtTokenManager.validatePayload(payload);

    if (errors) throw createError(400, `The provider token asked for is not valid: ${errors.join("; ")}`);

    return await jwtTokenManager.generateToken(payload);
  }
}
