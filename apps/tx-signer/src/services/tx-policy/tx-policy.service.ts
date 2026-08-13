import { DepositAuthorization, MsgAccountDeposit, MsgCreateCertificate, MsgMintACT } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment, MsgUpdateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { BasicAllowance, type Coin, MsgGrant, MsgGrantAllowance, MsgRevokeAllowance } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { Forbidden } from "http-errors";
import { inject, singleton } from "tsyringe";

import { BASIC_ALLOWANCE_TYPE_URL, DEPOSIT_AUTHORIZATION_TYPE_URL, type SignableMessageTypeUrl } from "@src/config/message-urls.config";
import { LoggerService } from "@src/providers/logging.provider";
import { AppConfigService } from "@src/services/app-config/app-config.service";

type ActorAddressReader = (message: unknown) => Array<string | undefined>;

function readActorAddresses<T>(read: (message: T) => Array<string | undefined>): ActorAddressReader {
  return message => read(message as T);
}

/** Deployment-scoped escrow accounts are addressed as `<owner>/<dseq>`, so the owner is the segment before the slash. */
function readEscrowAccountOwner(xid: string | undefined): string | undefined {
  return xid?.split("/")[0];
}

/**
 * Every field naming the account a message acts on behalf of, per message type. A message may only be signed by the
 * wallet it names, which stops a caller from spending one wallet's grants on another account's behalf.
 */
const ACTOR_ADDRESS_READERS = {
  [`/${MsgCreateDeployment.$type}` as const]: readActorAddresses((m: MsgCreateDeployment) => [m.id?.owner]),
  [`/${MsgUpdateDeployment.$type}` as const]: readActorAddresses((m: MsgUpdateDeployment) => [m.id?.owner]),
  [`/${MsgCloseDeployment.$type}` as const]: readActorAddresses((m: MsgCloseDeployment) => [m.id?.owner]),
  [`/${MsgCreateLease.$type}` as const]: readActorAddresses((m: MsgCreateLease) => [m.bidId?.owner]),
  [`/${MsgCreateCertificate.$type}` as const]: readActorAddresses((m: MsgCreateCertificate) => [m.owner]),
  [`/${MsgAccountDeposit.$type}` as const]: readActorAddresses((m: MsgAccountDeposit) => [m.signer, readEscrowAccountOwner(m.id?.xid)]),
  [`/${MsgGrantAllowance.$type}` as const]: readActorAddresses((m: MsgGrantAllowance) => [m.granter]),
  [`/${MsgRevokeAllowance.$type}` as const]: readActorAddresses((m: MsgRevokeAllowance) => [m.granter]),
  [`/${MsgGrant.$type}` as const]: readActorAddresses((m: MsgGrant) => [m.granter]),
  [`/${MsgMintACT.$type}` as const]: readActorAddresses((m: MsgMintACT) => [m.owner, m.to])
} satisfies Record<SignableMessageTypeUrl, ActorAddressReader>;

function hasActorBinding(typeUrl: string): typeUrl is SignableMessageTypeUrl {
  return typeUrl in ACTOR_ADDRESS_READERS;
}

@singleton()
export class TxPolicyService {
  constructor(
    @inject(LoggerService) private readonly logger: LoggerService,
    @inject(AppConfigService) private readonly config: AppConfigService
  ) {
    this.logger.setContext(TxPolicyService.name);
  }

  assertActingOnBehalfOf(messages: readonly EncodeObject[], signerAddress: string): void {
    for (const message of messages) {
      if (!hasActorBinding(message.typeUrl)) {
        this.reject("TX_ACTOR_BINDING_REJECTED", message.typeUrl, "message type has no actor binding rule");
      }

      for (const actorAddress of ACTOR_ADDRESS_READERS[message.typeUrl](message.value)) {
        if (actorAddress !== signerAddress) {
          this.reject("TX_ACTOR_BINDING_REJECTED", message.typeUrl, `acts on behalf of ${actorAddress ?? "an unset address"}, not ${signerAddress}`);
        }
      }
    }
  }

  /**
   * Requires every grant to name a finite spend limit in a grantable denomination. The amount itself is not bounded
   * here: legitimate allowances track cumulative customer top-ups, and a per-message ceiling would not bound the total
   * anyway. An *absent* limit is different in kind — the chain reads it as unlimited — so that is what gets rejected.
   */
  assertWithinGrantLimits(messages: readonly EncodeObject[]): void {
    for (const message of messages) {
      if (message.typeUrl === "/cosmos.feegrant.v1beta1.MsgGrantAllowance") {
        this.assertSpendLimits(message.typeUrl, this.readFeeAllowanceSpendLimits(message.value as MsgGrantAllowance));
      }

      if (message.typeUrl === "/cosmos.authz.v1beta1.MsgGrant") {
        this.assertSpendLimits(message.typeUrl, this.readDepositAuthorizationSpendLimits(message.value as MsgGrant));
      }
    }
  }

  /** Fees on a derived tx are only ever payable by the funding wallet, so a caller-supplied granter must match it. */
  assertFeeGranter(granterAddress: string | undefined, fundingWalletAddress: string): void {
    if (granterAddress !== undefined && granterAddress !== fundingWalletAddress) {
      this.reject("TX_FEE_GRANTER_REJECTED", "/cosmos.authz.v1beta1.MsgGrant", `fees may only be granted by the funding wallet, not ${granterAddress}`);
    }
  }

  private readFeeAllowanceSpendLimits(message: MsgGrantAllowance): Array<Coin | undefined> {
    const allowance = message.allowance;

    if (allowance?.typeUrl !== BASIC_ALLOWANCE_TYPE_URL) {
      this.reject("TX_GRANT_LIMIT_REJECTED", "/cosmos.feegrant.v1beta1.MsgGrantAllowance", `unsupported allowance type ${allowance?.typeUrl ?? "none"}`);
    }

    return this.decodeOrReject("/cosmos.feegrant.v1beta1.MsgGrantAllowance", () => BasicAllowance.decode(allowance.value)).spendLimit;
  }

  private readDepositAuthorizationSpendLimits(message: MsgGrant): Array<Coin | undefined> {
    const authorization = message.grant?.authorization;

    if (authorization?.typeUrl !== DEPOSIT_AUTHORIZATION_TYPE_URL) {
      this.reject("TX_GRANT_LIMIT_REJECTED", "/cosmos.authz.v1beta1.MsgGrant", `unsupported authorization type ${authorization?.typeUrl ?? "none"}`);
    }

    const { spendLimit, spendLimits } = this.decodeOrReject("/cosmos.authz.v1beta1.MsgGrant", () => DepositAuthorization.decode(authorization.value));

    return spendLimits.length > 0 ? spendLimits : [spendLimit];
  }

  /** A malformed payload tells us nothing about its spend limit, so it is rejected rather than allowed to escape as a decode error. */
  private decodeOrReject<T>(typeUrl: string, decode: () => T): T {
    try {
      return decode();
    } catch {
      this.reject("TX_GRANT_LIMIT_REJECTED", typeUrl, "declares a grant payload that cannot be decoded");
    }
  }

  private assertSpendLimits(typeUrl: string, limits: Array<Coin | undefined>): void {
    const declaredLimits = limits.filter((limit): limit is Coin => !!limit);

    if (declaredLimits.length === 0) {
      this.reject("TX_GRANT_LIMIT_REJECTED", typeUrl, "declares no spend limit, which the chain reads as unlimited");
    }

    const allowedDenoms = this.config.get("GRANT_ALLOWED_DENOMS");

    for (const { denom } of declaredLimits) {
      if (!allowedDenoms.includes(denom)) {
        this.reject("TX_GRANT_LIMIT_REJECTED", typeUrl, `denom ${denom} is not grantable`);
      }
    }
  }

  private reject(event: string, typeUrl: string, reason: string): never {
    this.logger.error({ event, typeUrl, reason });
    throw new Forbidden(`Message ${typeUrl} may not be signed by this wallet: ${reason}`);
  }
}
