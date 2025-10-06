import { MsgAccountDeposit, MsgCreateCertificate, Scope, Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { GroupSpec, MsgCloseDeployment, MsgCreateDeployment, MsgUpdateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { BasicAllowance, MsgExec, MsgGrantAllowance, MsgRevoke } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import addYears from "date-fns/addYears";
import Long from "long";
import { singleton } from "tsyringe";

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
  getFeesAllowanceGrantMsg({ limit, expiration, granter, grantee }: Omit<SpendingAuthorizationMsgOptions, "denom">) {
    return {
      typeUrl: "/cosmos.feegrant.v1beta1.MsgGrantAllowance",
      value: MsgGrantAllowance.fromPartial({
        granter,
        grantee,
        allowance: {
          typeUrl: "/cosmos.feegrant.v1beta1.BasicAllowance",
          value: Uint8Array.from(
            BasicAllowance.encode({
              spendLimit: [
                {
                  denom: "uakt",
                  amount: limit.toString()
                }
              ],
              expiration: expiration
            }).finish()
          )
        }
      })
    };
  }

  getDepositDeploymentGrantMsg({ denom, limit, expiration = addYears(new Date(), 10), granter, grantee }: SpendingAuthorizationMsgOptions) {
    return {
      typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
      value: {
        granter,
        grantee,
        grant: {
          authorization: {
            typeUrl: `/${MsgAccountDeposit.$type}`,
            value: MsgAccountDeposit.encode(
              MsgAccountDeposit.fromPartial({
                deposit: {
                  amount: {
                    denom,
                    amount: limit.toString()
                  },
                  sources: [Source.grant]
                }
              })
            ).finish()
          },
          expiration: expiration
            ? {
                seconds: Math.floor(expiration.getTime() / 1_000),
                nanos: Math.floor((expiration.getTime() % 1_000) * 1_000_000)
              }
            : undefined
        }
      }
    };
  }

  getRevokeAllowanceMsg({ granter, grantee }: { granter: string; grantee: string }) {
    return {
      typeUrl: "/cosmos.feegrant.v1beta1.MsgRevokeAllowance",
      value: MsgRevoke.fromPartial({
        granter,
        grantee,
        msgTypeUrl: "/cosmos.feegrant.v1beta1.MsgGrantAllowance"
      })
    };
  }

  getRevokeDepositDeploymentGrantMsg({ granter, grantee }: { granter: string; grantee: string }) {
    return {
      typeUrl: `/${MsgRevoke.$type}`,
      value: MsgRevoke.fromPartial({
        granter: granter,
        grantee: grantee,
        msgTypeUrl: "/akash.deployment.v1.MsgAccountDeposit"
      })
    };
  }

  getCloseDeploymentMsg(address: string, dseq: number | string) {
    return {
      typeUrl: `/${MsgCloseDeployment.$type}`,
      value: MsgCloseDeployment.fromPartial({
        id: {
          owner: address,
          dseq: Long.fromString(dseq.toString(), true)
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
          dseq: Long.fromString(dseq.toString(), true),
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
      typeUrl: `${MsgCreateCertificate.$type}`,
      value: MsgCreateCertificate.fromPartial({
        owner: address,
        cert: Buffer.from(crtpem, "base64"),
        pubkey: Buffer.from(pubpem, "base64")
      })
    };
  }

  getUpdateDeploymentMsg({ owner, dseq, hash }: UpdateDeploymentMsgOptions) {
    return {
      typeUrl: `${MsgUpdateDeployment.$type}`,
      value: MsgUpdateDeployment.fromPartial({
        id: {
          owner,
          dseq
        },
        hash
      })
    };
  }
}
