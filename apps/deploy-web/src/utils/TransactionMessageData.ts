import { DepositAuthorization, DepositAuthorization_Scope, MsgAccountDeposit, Scope, Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgBurnACT, MsgCreateCertificate, MsgMintACT, MsgRevokeCertificate } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment, MsgUpdateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgUpdateProvider } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { Coin } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { MsgSend } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { BasicAllowance, MsgGrant, MsgGrantAllowance, MsgRevoke, MsgRevokeAllowance } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";

import type { BidDto, NewDeploymentData } from "@src/types/deployment";

export class TransactionMessageData {
  static getRevokeCertificateMsg(address: string, serial: string) {
    return {
      typeUrl: `/${MsgRevokeCertificate.$type}`,
      value: MsgRevokeCertificate.fromPartial({
        id: {
          owner: address,
          serial
        }
      })
    };
  }

  static getCreateCertificateMsg(address: string, crtpem: string, pubpem: string) {
    return {
      typeUrl: `/${MsgCreateCertificate.$type}`,
      value: MsgCreateCertificate.fromPartial({
        owner: address,
        cert: Buffer.from(crtpem),
        pubkey: Buffer.from(pubpem)
      })
    };
  }

  static getCreateLeaseMsg(bid: BidDto) {
    return {
      typeUrl: `/${MsgCreateLease.$type}`,
      value: MsgCreateLease.fromPartial({
        bidId: {
          owner: bid.owner,
          dseq: bid.dseq,
          gseq: bid.gseq,
          oseq: bid.oseq,
          provider: bid.provider
        }
      })
    };
  }

  static getCreateDeploymentMsg(deploymentData: NewDeploymentData) {
    return {
      typeUrl: `/${MsgCreateDeployment.$type}`,
      value: MsgCreateDeployment.fromPartial({
        id: deploymentData.deploymentId,
        groups: deploymentData.groups,
        hash: deploymentData.hash,
        deposit: {
          amount: deploymentData.deposit,
          sources: [Source.grant, Source.balance]
        }
      })
    };
  }

  static getUpdateDeploymentMsg(deploymentData: NewDeploymentData) {
    return {
      typeUrl: `/${MsgUpdateDeployment.$type}`,
      value: MsgUpdateDeployment.fromPartial({
        id: deploymentData.deploymentId,
        hash: deploymentData.hash
      })
    };
  }

  static getDepositDeploymentMsg(signer: string, owner: string, dseq: string, amount: number, denom: string) {
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
          sources: [Source.grant, Source.balance]
        }
      })
    };
  }

  static getCloseDeploymentMsg(address: string, dseq: string) {
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

  static getSendTokensMsg(address: string, recipient: string, amount: number) {
    return {
      typeUrl: `/${MsgSend.$type}`,
      value: MsgSend.fromPartial({
        fromAddress: address,
        toAddress: recipient,
        amount: [
          {
            denom: "uakt",
            amount: amount.toString()
          }
        ]
      })
    };
  }

  static getGrantMsg(granter: string, grantee: string, spendLimit: Coin | Coin[], expiration: Date) {
    const authorization = Array.isArray(spendLimit)
      ? DepositAuthorization.fromPartial({
          spendLimit: {
            denom: spendLimit[0]?.denom ?? "uakt",
            amount: "0"
          },
          spendLimits: spendLimit,
          scopes: [DepositAuthorization_Scope.deployment]
        })
      : DepositAuthorization.fromPartial({
          spendLimit,
          scopes: [DepositAuthorization_Scope.deployment]
        });
    return {
      typeUrl: `/${MsgGrant.$type}`,
      value: MsgGrant.fromPartial({
        granter,
        grantee,
        grant: {
          authorization: {
            typeUrl: `/${DepositAuthorization.$type}`,
            value: DepositAuthorization.encode(authorization).finish()
          },
          expiration
        }
      })
    };
  }

  static getRevokeDepositMsg(granter: string, grantee: string) {
    return {
      typeUrl: `/${MsgRevoke.$type}`,
      value: MsgRevoke.fromPartial({
        granter: granter,
        grantee: grantee,
        msgTypeUrl: `/${MsgAccountDeposit.$type}`
      })
    };
  }

  static getGrantBasicAllowanceMsg(granter: string, grantee: string, spendLimit: number, denom: string, expiration?: Date) {
    const allowance = {
      typeUrl: `/${BasicAllowance.$type}`,
      value: Uint8Array.from(
        BasicAllowance.encode({
          spendLimit: [
            {
              denom: denom,
              amount: spendLimit.toString()
            }
          ],
          expiration
        }).finish()
      )
    };

    return {
      typeUrl: `/${MsgGrantAllowance.$type}`,
      value: MsgGrantAllowance.fromPartial({
        granter: granter,
        grantee: grantee,
        allowance: allowance
      })
    };
  }

  // static getGrantPeriodicAllowanceMsg(granter: string, grantee: string, spendLimit: number, denom: string, expiration?: Date) {
  //   const message = {
  //     typeUrl: TransactionMessageData.Types.MSG_GRANT_ALLOWANCE,
  //     value: {
  //       granter: granter,
  //       grantee: grantee,
  //       allowance: {
  //         typeUrl: "/cosmos.feegrant.v1beta1.PeriodicAllowance",
  //         value: {
  //           spend_limit: [{ denom: denom, amount: spendLimit.toString() }],
  //           // Can be undefined, the grant will be valid forever
  //           expiration: undefined
  //         }
  //       }
  //     }
  //   };

  //   if (expiration) {
  //     message.value.allowance.value.expiration = {
  //       seconds: Math.floor(expiration.getTime() / 1_000), // Convert milliseconds to seconds
  //       nanos: Math.floor((expiration.getTime() % 1_000) * 1_000_000) // Convert reminder into nanoseconds
  //     };
  //   }

  //   return message;
  // }

  static getRevokeAllowanceMsg(granter: string, grantee: string) {
    return {
      typeUrl: `/${MsgRevokeAllowance.$type}`,
      value: MsgRevokeAllowance.fromPartial({
        granter: granter,
        grantee: grantee
      })
    };
  }

  static getMintACTMsg(owner: string, amount: number, denom: string) {
    return {
      typeUrl: `/${MsgMintACT.$type}`,
      value: MsgMintACT.fromPartial({
        owner,
        to: owner,
        coinsToBurn: {
          denom,
          amount: amount.toString()
        }
      })
    };
  }

  static getBurnACTMsg(owner: string, amount: number) {
    return {
      typeUrl: `/${MsgBurnACT.$type}`,
      value: MsgBurnACT.fromPartial({
        owner,
        to: owner,
        coinsToBurn: {
          denom: "uact",
          amount: amount.toString()
        }
      })
    };
  }

  static getUpdateProviderMsg(owner: string, hostUri: string, attributes: { key: string; value: string }[], info?: { email: string; website: string }) {
    return {
      typeUrl: `/${MsgUpdateProvider.$type}`,
      value: MsgUpdateProvider.fromPartial({
        owner: owner,
        hostUri: hostUri,
        attributes: attributes,
        info: info
      })
    };
  }
}
