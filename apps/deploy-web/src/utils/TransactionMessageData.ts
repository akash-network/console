import { DepositAuthorization, DepositAuthorization_Scope, MsgAccountDeposit, Scope, Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCreateCertificate, MsgRevokeCertificate } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment, MsgUpdateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgUpdateProvider } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { MsgSend } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { BasicAllowance, MsgGrant, MsgGrantAllowance, MsgRevoke, MsgRevokeAllowance } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import Long from "long";

import type { BidDto } from "@src/types/deployment";
// import { BasicAllowance, MsgGrantAllowance, MsgRevoke, MsgRevokeAllowance } from "./proto/grant";
// import type { AppConfig } from "./init";
// import { protoTypes } from "./proto";

// export function setMessageTypes(config: AppConfig) {
//   TransactionMessageData.Types.MSG_CLOSE_DEPLOYMENT = `/akash.deployment.${config.deploymentVersion}.MsgCloseDeployment`;
//   TransactionMessageData.Types.MSG_CREATE_DEPLOYMENT = `/akash.deployment.${config.deploymentVersion}.MsgCreateDeployment`;
//   TransactionMessageData.Types.MSG_UPDATE_DEPLOYMENT = `/akash.deployment.${config.deploymentVersion}.MsgUpdateDeployment`;
//   TransactionMessageData.Types.MSG_CREATE_LEASE = `/akash.market.${config.marketVersion}.MsgCreateLease`;
//   TransactionMessageData.Types.MSG_REVOKE_CERTIFICATE = `/akash.cert.${config.certVersion}.MsgRevokeCertificate`;
//   TransactionMessageData.Types.MSG_CREATE_CERTIFICATE = `/akash.cert.${config.certVersion}.MsgCreateCertificate`;
//   TransactionMessageData.Types.MSG_ACCOUNT_DEPOSIT = `/akash.escrow.${config.escrowVersion}.MsgAccountDeposit`;
//   TransactionMessageData.Types.MSG_UPDATE_PROVIDER = `/akash.provider.${config.providerVersion}.MsgUpdateProvider`;
// }

export class TransactionMessageData {
  // static Types = {
  //   MSG_CLOSE_DEPLOYMENT: "",
  //   MSG_CREATE_DEPLOYMENT: "",
  //   MSG_UPDATE_DEPLOYMENT: "",
  //   MSG_CREATE_LEASE: "",
  //   MSG_REVOKE_CERTIFICATE: "",
  //   MSG_CREATE_CERTIFICATE: "",
  //   MSG_UPDATE_PROVIDER: "",
  //   MSG_ACCOUNT_DEPOSIT: "",

  //   // Cosmos
  //   MSG_SEND_TOKENS: "/cosmos.bank.v1beta1.MsgSend",
  //   MSG_GRANT: "/cosmos.authz.v1beta1.MsgGrant",
  //   MSG_REVOKE: "/cosmos.authz.v1beta1.MsgRevoke",
  //   MSG_GRANT_ALLOWANCE: "/cosmos.feegrant.v1beta1.MsgGrantAllowance",
  //   MSG_REVOKE_ALLOWANCE: "/cosmos.feegrant.v1beta1.MsgRevokeAllowance"
  // };

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
          dseq: Long.fromString(bid.dseq, true),
          gseq: bid.gseq,
          oseq: bid.oseq,
          provider: bid.provider
        }
      })
    };
  }

  static getCreateDeploymentMsg(deploymentData: Record<string, any>) {
    return {
      typeUrl: `/${MsgCreateDeployment.$type}`,
      value: MsgCreateDeployment.fromPartial({
        id: deploymentData.deploymentId,
        groups: deploymentData.groups,
        hash: deploymentData.hash,
        deposit: deploymentData.deposit
      })
    };
  }

  static getUpdateDeploymentMsg(deploymentData: Record<string, any>) {
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
          sources: [Source.grant]
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
          dseq: Long.fromString(dseq, true)
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

  static getGrantMsg(granter: string, grantee: string, spendLimit: number, expiration: Date, denom: string) {
    return {
      typeUrl: `/${MsgGrant.$type}`,
      value: MsgGrant.fromPartial({
        granter,
        grantee,
        grant: {
          authorization: {
            typeUrl: `/${DepositAuthorization.$type}`,
            value: DepositAuthorization.encode(
              DepositAuthorization.fromPartial({
                spendLimit: {
                  denom,
                  amount: spendLimit.toString()
                },
                scopes: [DepositAuthorization_Scope.deployment]
              })
            ).finish()
          },
          expiration
        }
      })
    };
  }

  static getRevokeMsg(granter: string, grantee: string, grantType: string) {
    const version = grantType.split(".")[2];
    const msgTypeUrl = `/akash.deployment.${version}.MsgDepositDeployment`;

    return {
      typeUrl: `/${MsgRevoke.$type}`,
      value: MsgRevoke.fromPartial({
        granter: granter,
        grantee: grantee,
        msgTypeUrl: msgTypeUrl
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
