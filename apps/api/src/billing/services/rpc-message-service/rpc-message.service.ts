import { DepositDeploymentAuthorization } from "@akashnetwork/akash-api/v1beta3";
import { MsgRevoke } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { BasicAllowance } from "cosmjs-types/cosmos/feegrant/v1beta1/feegrant";
import { MsgGrantAllowance } from "cosmjs-types/cosmos/feegrant/v1beta1/tx";
import { singleton } from "tsyringe";

export interface SpendingAuthorizationMsgOptions {
  granter: string;
  grantee: string;
  denom: string;
  limit: number;
  expiration?: Date;
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

  getDepositDeploymentGrantMsg({ denom, limit, expiration, granter, grantee }: SpendingAuthorizationMsgOptions) {
    return {
      typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
      value: {
        granter,
        grantee,
        grant: {
          authorization: {
            typeUrl: "/akash.deployment.v1beta3.DepositDeploymentAuthorization",
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
}
