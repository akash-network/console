import {
  DepositAuthorization,
  DepositAuthorization_Scope,
  MsgAccountDeposit,
  MsgCreateCertificate,
  MsgMintACT,
  Scope,
  Source
} from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { GroupSpec, MsgCloseDeployment, MsgCreateDeployment, MsgUpdateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { BasicAllowance, MsgExec, MsgGrant, MsgGrantAllowance, MsgRevoke, MsgRevokeAllowance } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import addYears from "date-fns/addYears";
import { singleton } from "tsyringe";

import { BillingConfigService } from "../billing-config/billing-config.service";

export interface SpendingAuthorizationMsgOptions {
  granter: string;
  grantee: string;
  denom: string;
  limit: number;
  expiration?: Date;
}

interface DepositDeploymentMsgOptionsBase {
  dseq: number | string;
  amount: number;
  denom: string;
  owner: string;
}

export interface DepositDeploymentMsgOptions extends DepositDeploymentMsgOptionsBase {
  signer: string;
}

export interface CreateDeploymentMsgOptions extends DepositDeploymentMsgOptionsBase {
  groups: GroupSpec[];
  hash: Uint8Array;
}

export interface CreateLeaseMsgOptions {
  owner: string;
  dseq: number | string;
  gseq: number;
  oseq: number;
  provider: string;
}

export interface UpdateDeploymentMsgOptions {
  owner: string;
  dseq: string;
  hash: Uint8Array;
}

@singleton()
export class RpcMessageService {
  readonly #deploymentDenom: string;

  constructor(billingConfig: BillingConfigService) {
    this.#deploymentDenom = billingConfig.get("DEPLOYMENT_GRANT_DENOM");
  }

  getFeesAllowanceGrantMsg({ limit, expiration, granter, grantee }: Omit<SpendingAuthorizationMsgOptions, "denom">) {
    return {
      typeUrl: `/${MsgGrantAllowance.$type}`,
      value: MsgGrantAllowance.fromPartial({
        granter,
        grantee,
        allowance: {
          typeUrl: `/${BasicAllowance.$type}`,
          value: Uint8Array.from(
            BasicAllowance.encode({
              spendLimit: [
                {
                  denom: "uakt",
                  amount: limit.toString()
                }
              ],
              expiration
            }).finish()
          )
        }
      })
    };
  }

  getDepositDeploymentGrantMsg({ denom, limit, expiration = addYears(new Date(), 10), granter, grantee }: SpendingAuthorizationMsgOptions) {
    return {
      typeUrl: `/${MsgGrant.$type}`,
      value: {
        granter,
        grantee,
        grant: {
          authorization: {
            typeUrl: `/${DepositAuthorization.$type}`,
            value: DepositAuthorization.encode(
              this.#deploymentDenom === "uact"
                ? DepositAuthorization.fromPartial({
                    spendLimit: {
                      denom,
                      amount: "0"
                    },
                    spendLimits: [
                      {
                        denom,
                        amount: limit.toString()
                      }
                    ],
                    scopes: [DepositAuthorization_Scope.deployment]
                  })
                : DepositAuthorization.fromPartial({
                    spendLimit: {
                      denom,
                      amount: limit.toString()
                    },
                    scopes: [DepositAuthorization_Scope.deployment]
                  })
            ).finish()
          },
          expiration
        }
      }
    };
  }

  getRevokeAllowanceMsg({ granter, grantee }: { granter: string; grantee: string }) {
    return {
      typeUrl: `/${MsgRevokeAllowance.$type}`,
      value: MsgRevoke.fromPartial({
        granter,
        grantee,
        msgTypeUrl: `/${MsgGrantAllowance.$type}`
      })
    };
  }

  getRevokeDepositDeploymentGrantMsg({ granter, grantee }: { granter: string; grantee: string }) {
    return {
      typeUrl: `/${MsgRevoke.$type}`,
      value: MsgRevoke.fromPartial({
        granter: granter,
        grantee: grantee,
        msgTypeUrl: `/${MsgAccountDeposit.$type}`
      })
    };
  }

  getCloseDeploymentMsg(address: string, dseq: number | string) {
    return {
      typeUrl: `/${MsgCloseDeployment.$type}`,
      value: MsgCloseDeployment.fromPartial({
        id: {
          owner: address,
          dseq
        }
      })
    };
  }

  getCreateDeploymentMsg({ owner, dseq, groups, hash, denom, amount }: CreateDeploymentMsgOptions) {
    return {
      typeUrl: `/${MsgCreateDeployment.$type}`,
      value: MsgCreateDeployment.fromPartial({
        id: {
          owner,
          dseq
        },
        groups,
        hash,
        deposit: {
          amount: {
            denom,
            amount: amount.toString()
          },
          sources: [Source.grant]
        }
      })
    };
  }

  getCreateLeaseMsg({ owner, dseq, gseq, oseq, provider }: CreateLeaseMsgOptions) {
    return {
      typeUrl: `/${MsgCreateLease.$type}`,
      value: MsgCreateLease.fromPartial({
        bidId: {
          owner,
          dseq,
          gseq,
          oseq,
          provider
        }
      })
    };
  }

  getDepositDeploymentMsg({ signer, owner, dseq, amount, denom }: DepositDeploymentMsgOptions) {
    return {
      typeUrl: `/${MsgAccountDeposit.$type}`,
      value: MsgAccountDeposit.fromPartial({
        signer,
        id: {
          scope: Scope.deployment,
          xid: `${owner}/${dseq}`
        },
        deposit: {
          amount: {
            denom,
            amount: amount.toString()
          },
          sources: [Source.grant]
        }
      })
    };
  }

  getExecDepositDeploymentMsg({ signer, owner, dseq, amount, denom, grantee }: DepositDeploymentMsgOptions & { grantee: string }) {
    return {
      typeUrl: `/${MsgExec.$type}`,
      value: {
        grantee,
        msgs: [
          {
            typeUrl: `/${MsgAccountDeposit.$type}`,
            value: MsgAccountDeposit.encode(
              MsgAccountDeposit.fromPartial({
                signer,
                id: {
                  scope: Scope.deployment,
                  xid: `${owner}/${dseq}`
                },
                deposit: {
                  amount: {
                    denom,
                    amount: amount.toString()
                  },
                  sources: [Source.grant]
                }
              })
            ).finish()
          }
        ]
      }
    };
  }

  getCreateCertificateMsg(address: string, crtpem: string, pubpem: string) {
    return {
      typeUrl: `/${MsgCreateCertificate.$type}`,
      value: MsgCreateCertificate.fromPartial({
        owner: address,
        cert: Buffer.from(crtpem),
        pubkey: Buffer.from(pubpem)
      })
    };
  }

  getUpdateDeploymentMsg({ owner, dseq, hash }: UpdateDeploymentMsgOptions) {
    return {
      typeUrl: `/${MsgUpdateDeployment.$type}`,
      value: MsgUpdateDeployment.fromPartial({
        id: {
          owner,
          dseq
        },
        hash
      })
    };
  }

  getMintACTMsg({ owner, amount }: { owner: string; amount: number }) {
    return {
      typeUrl: `/${MsgMintACT.$type}`,
      value: MsgMintACT.fromPartial({
        owner,
        to: owner,
        coinsToBurn: {
          denom: "uakt",
          amount: amount.toString()
        }
      })
    };
  }
}
