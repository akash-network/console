import type { EncodeObject } from "@cosmjs/proto-signing";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";

interface LimitCollectorInput {
  granter: string;
  grantee: string;
  denom?: string;
  prev?: {
    limit?: number;
    expiration?: Date;
  };
  next?: {
    limit: number;
    expiration: Date;
  };
}

interface LimitState {
  uaktFeeLimit: number;
  usdcFeeLimit: number;
  uaktDeploymentLimit: number;
  usdcDeploymentLimit: number;
  expiration: Date;
}

interface CollectionInput {
  granter: string;
  prev: Partial<LimitState>;
  next?: LimitState;
}

export class AutoTopUpMessageService {
  constructor(private readonly usdcDenom: string) {}

  collectMessages(options: CollectionInput): EncodeObject[] {
    const uaktSides = {
      granter: options.granter,
      grantee: browserEnvConfig.NEXT_PUBLIC_UAKT_TOP_UP_MASTER_WALLET_ADDRESS
    };
    const usdcSides = {
      granter: options.granter,
      grantee: browserEnvConfig.NEXT_PUBLIC_USDC_TOP_UP_MASTER_WALLET_ADDRESS
    };

    return [
      ...this.collectFeeMessages({
        ...uaktSides,
        prev: {
          limit: options.prev.uaktFeeLimit,
          expiration: options.prev.expiration
        },
        next: options.next && {
          limit: options.next.uaktFeeLimit,
          expiration: options.next.expiration
        }
      }),
      ...this.collectFeeMessages({
        ...usdcSides,
        prev: {
          limit: options.prev.usdcFeeLimit,
          expiration: options.prev.expiration
        },
        next: options.next && {
          limit: options.next.usdcFeeLimit,
          expiration: options.next.expiration
        }
      }),
      ...this.collectDeploymentMessages({
        ...uaktSides,
        denom: "uakt",
        prev: {
          limit: options.prev.uaktDeploymentLimit,
          expiration: options.prev.expiration
        },
        next: options.next && {
          limit: options.next.uaktDeploymentLimit,
          expiration: options.next.expiration
        }
      }),
      ...this.collectDeploymentMessages({
        ...usdcSides,
        denom: this.usdcDenom,
        prev: {
          limit: options.prev.usdcDeploymentLimit,
          expiration: options.prev.expiration
        },
        next: options.next && {
          limit: options.next.usdcDeploymentLimit,
          expiration: options.next.expiration
        }
      })
    ];
  }

  private collectFeeMessages(options: LimitCollectorInput): EncodeObject[] {
    const messages: EncodeObject[] = [];
    const isSameExpiration = options.prev?.expiration?.getTime() === options.next?.expiration.getTime();
    const isSameLimit = options.prev?.limit === options.next?.limit;

    if (isSameExpiration && isSameLimit) {
      return messages;
    }

    if (typeof options.prev?.limit !== "undefined") {
      messages.push(TransactionMessageData.getRevokeAllowanceMsg(options.granter, options.grantee));
    }

    if (options.next?.limit) {
      messages.push(TransactionMessageData.getGrantBasicAllowanceMsg(options.granter, options.grantee, options.next.limit, "uakt", options.next.expiration));
    }

    return messages;
  }

  private collectDeploymentMessages(options: LimitCollectorInput): EncodeObject[] {
    const messages: EncodeObject[] = [];
    const isSameExpiration = options.prev?.expiration?.getTime() === options.next?.expiration.getTime();
    const isSameLimit = options.prev?.limit === options.next?.limit;

    if (isSameExpiration && isSameLimit) {
      return messages;
    }

    if (options.next?.limit) {
      messages.push(TransactionMessageData.getGrantMsg(options.granter, options.grantee, options.next.limit, options.next.expiration, options.denom || "uakt"));
    } else if (typeof options.prev?.limit !== "undefined") {
      messages.push(TransactionMessageData.getRevokeMsg(options.granter, options.grantee, "/akash.deployment.v1beta3.DepositDeploymentAuthorization"));
    }

    return messages;
  }
}
