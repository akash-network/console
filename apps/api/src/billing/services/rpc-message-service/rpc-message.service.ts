import { DepositDeploymentAuthorization } from "@akashnetwork/akash-api/v1beta3";
import { MsgRevoke } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { BasicAllowance } from "cosmjs-types/cosmos/feegrant/v1beta1/feegrant";
import { MsgGrantAllowance } from "cosmjs-types/cosmos/feegrant/v1beta1/tx";
import Long from "long";
import { singleton } from "tsyringe";

interface SpendingAuthorizationOptions {
  granter: string;
  grantee: string;
  denom: string;
  limit: number;
  expiration?: Date;
}

@singleton()
export class RpcMessageService {
  getAllGrantMsgs(
    options: Omit<SpendingAuthorizationOptions, "limit"> & {
      limits: {
        deployment: number;
        fees: number;
      };
    }
  ) {
    return [this.getGrantMsg({ ...options, limit: options.limits.deployment }), this.getGrantBasicAllowanceMsg({ ...options, limit: options.limits.fees })];
  }

  getGrantBasicAllowanceMsg({ denom, limit, expiration, granter, grantee }: SpendingAuthorizationOptions) {
    const allowance = {
      typeUrl: "/cosmos.feegrant.v1beta1.BasicAllowance",
      value: Uint8Array.from(
        BasicAllowance.encode({
          spendLimit: [
            {
              denom: denom,
              amount: limit.toString()
            }
          ],
          expiration: expiration
            ? {
                seconds: Long.fromInt(Math.floor(expiration.getTime() / 1_000)) as unknown as Long,
                nanos: Math.floor((expiration.getTime() % 1_000) * 1_000_000)
              }
            : undefined
        }).finish()
      )
    };

    return {
      typeUrl: "/cosmos.feegrant.v1beta1.MsgGrantAllowance",
      value: MsgGrantAllowance.fromPartial({
        granter: granter,
        grantee: grantee,
        allowance: allowance
      })
    };
  }

  getGrantMsg({ denom, limit, expiration, granter, grantee }: SpendingAuthorizationOptions) {
    return {
      typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
      value: {
        granter: granter,
        grantee: grantee,
        grant: {
          authorization: {
            typeUrl: "/akash.deployment.v1beta3.DepositDeploymentAuthorization",
            value: DepositDeploymentAuthorization.encode(
              DepositDeploymentAuthorization.fromPartial({
                spendLimit: {
                  denom: denom,
                  amount: limit.toString()
                }
              })
            ).finish()
          },
          expiration: {
            seconds: Math.floor(expiration.getTime() / 1_000),
            nanos: Math.floor((expiration.getTime() % 1_000) * 1_000_000)
          }
        }
      }
    };
  }

  getRevokeAllowanceMsg({ granter, grantee }: { granter: string; grantee: string }) {
    return {
      typeUrl: "/cosmos.authz.v1beta1.MsgRevoke",
      value: MsgRevoke.fromPartial({
        granter: granter,
        grantee: grantee,
        msgTypeUrl: "/cosmos.feegrant.v1beta1.MsgGrantAllowance"
      })
    };
  }
}
