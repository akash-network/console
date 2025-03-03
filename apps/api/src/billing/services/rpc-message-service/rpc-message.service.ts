import { GroupSpec } from "@akashnetwork/akash-api/akash/deployment/v1beta3";
import { DepositDeploymentAuthorization, MsgCloseDeployment, MsgCreateDeployment, MsgDepositDeployment } from "@akashnetwork/akash-api/v1beta3";
import { MsgExec, MsgRevoke } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { BasicAllowance } from "cosmjs-types/cosmos/feegrant/v1beta1/feegrant";
import { MsgGrantAllowance } from "cosmjs-types/cosmos/feegrant/v1beta1/tx";
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
  dseq: number;
  amount: number;
  denom: string;
  owner: string;
}

export interface DepositDeploymentMsgOptions extends DepositDeploymentMsgOptionsBase {
  depositor: string;
}

export interface ExecDepositDeploymentMsgOptions extends DepositDeploymentMsgOptionsBase {
  grantee: string;
}

export interface CreateDeploymentMsgOptions extends DepositDeploymentMsgOptionsBase {
  groups: GroupSpec[];
  manifestVersion: Uint8Array;
  depositor: string;
}

export interface DepositDeploymentMsg {
  typeUrl: "/akash.deployment.v1beta3.MsgDepositDeployment";
  value: {
    id: {
      owner: string;
      dseq: Long;
    };
    amount: { denom: string; amount: string };
    depositor: string;
  };
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
                ? {
                    seconds: BigInt(Math.floor(expiration.getTime() / 1_000)),
                    nanos: Math.floor((expiration.getTime() % 1_000) * 1_000_000)
                  }
                : undefined
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
            typeUrl: `/${DepositDeploymentAuthorization.$type}`,
            value: DepositDeploymentAuthorization.encode(
              DepositDeploymentAuthorization.fromPartial({
                spendLimit: {
                  denom,
                  amount: limit.toString()
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
      typeUrl: MsgRevoke.typeUrl,
      value: MsgRevoke.fromPartial({
        granter: granter,
        grantee: grantee,
        msgTypeUrl: "/akash.deployment.v1beta3.MsgDepositDeployment"
      })
    };
  }

  getCloseDeploymentMsg(address: string, dseq: number) {
    return {
      typeUrl: `/${MsgCloseDeployment.$type}`,
      value: {
        id: {
          owner: address,
          dseq: Long.fromString(dseq.toString(), true)
        }
      }
    };
  }

  getCreateDeploymentMsg({ owner, dseq, groups, manifestVersion, denom, amount, depositor }: CreateDeploymentMsgOptions) {
    return {
      typeUrl: `/akash.deployment.v1beta3.MsgCreateDeployment`,
      value: MsgCreateDeployment.fromPartial({
        id: {
          owner,
          dseq,
        },
        groups,
        version: manifestVersion,
        deposit: {
          denom,
          amount: amount.toString(),
        },
        depositor,
      })
    };
  }

  getDepositDeploymentMsg({ owner, dseq, amount, denom, depositor }: DepositDeploymentMsgOptions): DepositDeploymentMsg {
    return {
      typeUrl: "/akash.deployment.v1beta3.MsgDepositDeployment",
      value: {
        id: {
          owner,
          dseq: Long.fromString(dseq.toString(), true)
        },
        amount: {
          denom,
          amount: amount.toString()
        },
        depositor: depositor || owner
      }
    };
  }

  getExecDepositDeploymentMsg({ owner, dseq, amount, denom, grantee }: ExecDepositDeploymentMsgOptions) {
    return {
      typeUrl: MsgExec.typeUrl,
      value: {
        grantee,
        msgs: [
          {
            typeUrl: `/${MsgDepositDeployment.$type}`,
            value: MsgDepositDeployment.encode(
              MsgDepositDeployment.fromPartial({
                id: {
                  owner,
                  dseq: Long.fromString(dseq.toString(), true)
                },
                amount: {
                  denom,
                  amount: amount.toString()
                },
                depositor: owner
              })
            ).finish()
          }
        ]
      }
    };
  }
}
