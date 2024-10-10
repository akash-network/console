import Long from "long";

import networkStore from "@src/store/networkStore";
import { BidDto } from "@src/types/deployment";
import { BasicAllowance, MsgGrantAllowance, MsgRevoke, MsgRevokeAllowance } from "./proto/grant";
import { protoTypes } from "./proto";

export function setMessageTypes() {
  TransactionMessageData.Types.MSG_CLOSE_DEPLOYMENT = `/akash.deployment.${networkStore.apiVersion}.MsgCloseDeployment`;
  TransactionMessageData.Types.MSG_CREATE_DEPLOYMENT = `/akash.deployment.${networkStore.apiVersion}.MsgCreateDeployment`;
  TransactionMessageData.Types.MSG_DEPOSIT_DEPLOYMENT = `/akash.deployment.${networkStore.apiVersion}.MsgDepositDeployment`;
  TransactionMessageData.Types.MSG_DEPOSIT_DEPLOYMENT_AUTHZ = `/akash.deployment.${networkStore.apiVersion}.DepositDeploymentAuthorization`;
  TransactionMessageData.Types.MSG_UPDATE_DEPLOYMENT = `/akash.deployment.${networkStore.apiVersion}.MsgUpdateDeployment`;
  TransactionMessageData.Types.MSG_CREATE_LEASE = `/akash.market.${networkStore.marketApiVersion}.MsgCreateLease`;
  TransactionMessageData.Types.MSG_REVOKE_CERTIFICATE = `/akash.cert.${networkStore.apiVersion}.MsgRevokeCertificate`;
  TransactionMessageData.Types.MSG_CREATE_CERTIFICATE = `/akash.cert.${networkStore.apiVersion}.MsgCreateCertificate`;

  TransactionMessageData.Types.MSG_UPDATE_PROVIDER = `/akash.provider.${networkStore.apiVersion}.MsgUpdateProvider`;
}

export class TransactionMessageData {
  static Types = {
    MSG_CLOSE_DEPLOYMENT: "",
    MSG_CREATE_DEPLOYMENT: "",
    MSG_DEPOSIT_DEPLOYMENT: "",
    MSG_DEPOSIT_DEPLOYMENT_AUTHZ: "",
    MSG_UPDATE_DEPLOYMENT: "",
    // TODO MsgCloseGroup
    // TODO MsgPauseGroup
    // TODO MsgStartGroup
    MSG_CREATE_LEASE: "",
    MSG_REVOKE_CERTIFICATE: "",
    MSG_CREATE_CERTIFICATE: "",
    MSG_UPDATE_PROVIDER: "",

    // Cosmos
    MSG_SEND_TOKENS: "/cosmos.bank.v1beta1.MsgSend",
    MSG_GRANT: "/cosmos.authz.v1beta1.MsgGrant",
    MSG_REVOKE: "/cosmos.authz.v1beta1.MsgRevoke",
    MSG_GRANT_ALLOWANCE: "/cosmos.feegrant.v1beta1.MsgGrantAllowance",
    MSG_REVOKE_ALLOWANCE: "/cosmos.feegrant.v1beta1.MsgRevokeAllowance"
  };

  static getRevokeCertificateMsg(address: string, serial: string) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_REVOKE_CERTIFICATE,
      value: {
        id: {
          owner: address,
          serial
        }
      }
    };

    return message;
  }

  static getCreateCertificateMsg(address: string, crtpem: string, pubpem: string) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_CREATE_CERTIFICATE,
      value: {
        owner: address,
        cert: Buffer.from(crtpem).toString("base64"),
        pubkey: Buffer.from(pubpem).toString("base64")
      }
    };

    return message;
  }

  static getCreateLeaseMsg(bid: BidDto) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_CREATE_LEASE,
      value: {
        bidId: {
          owner: bid.owner,
          dseq: Long.fromString(bid.dseq, true),
          gseq: bid.gseq,
          oseq: bid.oseq,
          provider: bid.provider
        }
      }
    };

    return message;
  }

  static getCreateDeploymentMsg(deploymentData) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_CREATE_DEPLOYMENT,
      value: {
        id: deploymentData.deploymentId,
        groups: deploymentData.groups,
        version: deploymentData.version,
        deposit: deploymentData.deposit,
        depositor: deploymentData.depositor
      }
    };

    return message;
  }

  static getUpdateDeploymentMsg(deploymentData) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_UPDATE_DEPLOYMENT,
      value: {
        id: deploymentData.deploymentId,
        version: deploymentData.version
      }
    };

    return message;
  }

  static getDepositDeploymentMsg(address: string, dseq: string, depositAmount: number, denom: string, depositorAddress: string | null = null) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_DEPOSIT_DEPLOYMENT,
      value: {
        id: {
          owner: address,
          dseq: Long.fromString(dseq, true)
        },
        amount: {
          denom,
          amount: depositAmount.toString()
        },
        depositor: depositorAddress || address
      }
    };

    return message;
  }

  static getCloseDeploymentMsg(address: string, dseq: string) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_CLOSE_DEPLOYMENT,
      value: {
        id: {
          owner: address,
          dseq: Long.fromString(dseq, true)
        }
      }
    };

    return message;
  }

  static getSendTokensMsg(address: string, recipient: string, amount: number) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_SEND_TOKENS,
      value: {
        fromAddress: address,
        toAddress: recipient,
        amount: [
          {
            denom: "uakt",
            amount: amount.toString()
          }
        ]
      }
    };

    return message;
  }

  static getGrantMsg(granter: string, grantee: string, spendLimit: number, expiration: Date, denom: string) {
    const grantMsg = {
      typeUrl: TransactionMessageData.Types.MSG_GRANT,
      value: {
        granter: granter,
        grantee: grantee,
        grant: {
          authorization: {
            typeUrl: TransactionMessageData.Types.MSG_DEPOSIT_DEPLOYMENT_AUTHZ,
            value: protoTypes.DepositDeploymentAuthorization.encode(
              protoTypes.DepositDeploymentAuthorization.fromPartial({
                spendLimit: {
                  denom: denom,
                  amount: spendLimit.toString()
                }
              })
            ).finish()
          },
          expiration: {
            seconds: Math.floor(expiration.getTime() / 1_000), // Convert milliseconds to seconds
            nanos: Math.floor((expiration.getTime() % 1_000) * 1_000_000) // Convert reminder into nanoseconds
          }
        }
      }
    };

    return grantMsg;
  }

  static getRevokeMsg(granter: string, grantee: string, grantType: string) {
    const version = grantType.split(".")[2];
    const msgTypeUrl = `/akash.deployment.${version}.MsgDepositDeployment`;

    const message = {
      typeUrl: TransactionMessageData.Types.MSG_REVOKE,
      value: MsgRevoke.fromPartial({
        granter: granter,
        grantee: grantee,
        msgTypeUrl: msgTypeUrl
      })
    };

    return message;
  }

  static getGrantBasicAllowanceMsg(granter: string, grantee: string, spendLimit: number, denom: string, expiration?: Date) {
    const allowance = {
      typeUrl: "/cosmos.feegrant.v1beta1.BasicAllowance",
      value: Uint8Array.from(
        BasicAllowance.encode({
          spendLimit: [
            {
              denom: denom,
              amount: spendLimit.toString()
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
    };

    const message = {
      typeUrl: TransactionMessageData.Types.MSG_GRANT_ALLOWANCE,
      value: MsgGrantAllowance.fromPartial({
        granter: granter,
        grantee: grantee,
        allowance: allowance
      })
    };

    return message;
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
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_REVOKE_ALLOWANCE,
      value: MsgRevokeAllowance.fromPartial({
        granter: granter,
        grantee: grantee
      })
    };

    return message;
  }

  static getUpdateProviderMsg(owner: string, hostUri: string, attributes: { key: string; value: string }[], info?: { email: string; website: string }) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_UPDATE_PROVIDER,
      value: {
        owner: owner,
        hostUri: hostUri,
        attributes: attributes,
        info: info
      }
    };

    return message;
  }
}
