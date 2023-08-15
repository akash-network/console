import { protoTypes } from "./protoTypes";
import { networkVersion } from "./constants";
import { Attribute, ProviderInfo } from "./proto/akash/v1beta3";

export function setMessageTypes() {
  TransactionMessageData.Types.MSG_CLOSE_DEPLOYMENT = `/akash.deployment.${networkVersion}.MsgCloseDeployment`;
  TransactionMessageData.Types.MSG_CREATE_DEPLOYMENT = `/akash.deployment.${networkVersion}.MsgCreateDeployment`;
  TransactionMessageData.Types.MSG_DEPOSIT_DEPLOYMENT = `/akash.deployment.${networkVersion}.MsgDepositDeployment`;
  TransactionMessageData.Types.MSG_UPDATE_DEPLOYMENT = `/akash.deployment.${networkVersion}.MsgUpdateDeployment`;
  TransactionMessageData.Types.MSG_CREATE_LEASE = `/akash.market.${networkVersion}.MsgCreateLease`;
  TransactionMessageData.Types.MSG_REVOKE_CERTIFICATE = `/akash.cert.${networkVersion}.MsgRevokeCertificate`;
  TransactionMessageData.Types.MSG_CREATE_CERTIFICATE = `/akash.cert.${networkVersion}.MsgCreateCertificate`;

  TransactionMessageData.Types.MSG_UPDATE_PROVIDER = `/akash.provider.${networkVersion}.MsgUpdateProvider`;
}

export class TransactionMessageData {
  static Types = {
    MSG_CLOSE_DEPLOYMENT: "",
    MSG_CREATE_DEPLOYMENT: "",
    MSG_DEPOSIT_DEPLOYMENT: "",
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
    MSG_REVOKE: "/cosmos.authz.v1beta1.MsgRevoke"
  };

  static getRevokeCertificateMsg(address, serial) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_REVOKE_CERTIFICATE,
      value: {
        id: {
          owner: address,
          serial
        }
      }
    };

    const err = protoTypes.MsgRevokeCertificate.verify(message.value);

    if (err) throw err;

    return message;
  }

  static getCreateCertificateMsg(address, crtpem, pubpem) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_CREATE_CERTIFICATE,
      value: {
        owner: address,
        cert: Buffer.from(crtpem).toString("base64"),
        pubkey: Buffer.from(pubpem).toString("base64")
      }
    };

    const err = protoTypes.MsgCreateCertificate.verify(message.value);

    if (err) throw err;

    return message;
  }

  static getCreateLeaseMsg(bid) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_CREATE_LEASE,
      value: {
        bid_id: {
          owner: bid.owner,
          dseq: parseInt(bid.dseq),
          gseq: bid.gseq,
          oseq: bid.oseq,
          provider: bid.provider
        }
      }
    };

    const err = protoTypes.MsgCreateLease.verify(message.value);

    if (err) throw err;

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

    // TODO
    //const err = protoTypes.MsgCreateDeployment.verify(txData.value);
    let err = null;
    if (err) throw err;

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

    // const err = protoTypes.MsgUpdateDeployment.verify(txData.value);

    let err = null;
    if (err) throw err;

    return message;
  }

  static getDepositDeploymentMsg(address, dseq, depositAmount, depositorAddress = null) {
    let message = {
      typeUrl: TransactionMessageData.Types.MSG_DEPOSIT_DEPLOYMENT,
      value: {
        id: {
          owner: address,
          dseq: parseInt(dseq)
        },
        amount: {
          denom: "uakt",
          amount: depositAmount.toString()
        },
        depositor: depositorAddress || address
      }
    };

    const err = protoTypes.MsgDepositDeployment.verify(message.value);

    if (err) throw err;

    return message;
  }

  static getCloseDeploymentMsg(address, dseq) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_CLOSE_DEPLOYMENT,
      value: {
        id: {
          owner: address,
          dseq: parseInt(dseq)
        }
      }
    };

    const err = protoTypes.MsgCloseDeployment.verify(message.value);

    if (err) throw err;

    return message;
  }

  static getSendTokensMsg(address, recipient, amount) {
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

  static getGrantMsg(granter: string, grantee: string, spendLimit: number, expiration: Date) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_GRANT,
      value: {
        granter: granter,
        grantee: grantee,
        grant: {
          authorization: {
            type_url: "/akash.deployment.v1beta2.DepositDeploymentAuthorization",
            value: {
              spend_limit: {
                denom: "uakt",
                amount: spendLimit.toString()
              }
            }
          },
          expiration: {
            seconds: Math.floor(expiration.getTime() / 1_000), // Convert milliseconds to seconds
            nanos: Math.floor((expiration.getTime() % 1_000) * 1_000_000) // Convert reminder into nanoseconds
          }
        }
      }
    };

    return message;
  }

  static getRevokeMsg(granter: string, grantee: string) {
    const message = {
      typeUrl: TransactionMessageData.Types.MSG_REVOKE,
      value: {
        granter: granter,
        grantee: grantee,
        msgTypeUrl: "/akash.deployment.v1beta2.MsgDepositDeployment"
      }
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
