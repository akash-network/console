"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionMessageData = void 0;
var akash_v1_1 = require("@akashnetwork/chain-sdk/private-types/akash.v1");
var akash_v1_2 = require("@akashnetwork/chain-sdk/private-types/akash.v1");
var akash_v1beta4_1 = require("@akashnetwork/chain-sdk/private-types/akash.v1beta4");
var akash_v1beta4_2 = require("@akashnetwork/chain-sdk/private-types/akash.v1beta4");
var akash_v1beta5_1 = require("@akashnetwork/chain-sdk/private-types/akash.v1beta5");
var cosmos_v1beta1_1 = require("@akashnetwork/chain-sdk/private-types/cosmos.v1beta1");
var cosmos_v1beta1_2 = require("@akashnetwork/chain-sdk/private-types/cosmos.v1beta1");
var long_1 = require("long");
var TransactionMessageData = /** @class */ (function () {
    function TransactionMessageData() {
    }
    TransactionMessageData.getRevokeCertificateMsg = function (address, serial) {
        return {
            typeUrl: "/".concat(akash_v1_2.MsgRevokeCertificate.$type),
            value: akash_v1_2.MsgRevokeCertificate.fromPartial({
                id: {
                    owner: address,
                    serial: serial
                }
            })
        };
    };
    TransactionMessageData.getCreateCertificateMsg = function (address, crtpem, pubpem) {
        return {
            typeUrl: "/".concat(akash_v1_2.MsgCreateCertificate.$type),
            value: akash_v1_2.MsgCreateCertificate.fromPartial({
                owner: address,
                cert: Buffer.from(crtpem),
                pubkey: Buffer.from(pubpem)
            })
        };
    };
    TransactionMessageData.getCreateLeaseMsg = function (bid) {
        return {
            typeUrl: "/".concat(akash_v1beta5_1.MsgCreateLease.$type),
            value: akash_v1beta5_1.MsgCreateLease.fromPartial({
                bidId: {
                    owner: bid.owner,
                    dseq: long_1.default.fromString(bid.dseq, true),
                    gseq: bid.gseq,
                    oseq: bid.oseq,
                    provider: bid.provider
                }
            })
        };
    };
    TransactionMessageData.getCreateDeploymentMsg = function (deploymentData) {
        return {
            typeUrl: "/".concat(akash_v1beta4_1.MsgCreateDeployment.$type),
            value: akash_v1beta4_1.MsgCreateDeployment.fromPartial({
                id: deploymentData.deploymentId,
                groups: deploymentData.groups,
                hash: deploymentData.hash,
                deposit: {
                    amount: deploymentData.deposit,
                    sources: [akash_v1_1.Source.grant, akash_v1_1.Source.balance]
                }
            })
        };
    };
    TransactionMessageData.getUpdateDeploymentMsg = function (deploymentData) {
        return {
            typeUrl: "/".concat(akash_v1beta4_1.MsgUpdateDeployment.$type),
            value: akash_v1beta4_1.MsgUpdateDeployment.fromPartial({
                id: deploymentData.deploymentId,
                hash: deploymentData.hash
            })
        };
    };
    TransactionMessageData.getDepositDeploymentMsg = function (signer, owner, dseq, amount, denom) {
        return {
            typeUrl: "/".concat(akash_v1_1.MsgAccountDeposit.$type),
            value: akash_v1_1.MsgAccountDeposit.fromPartial({
                signer: signer,
                id: {
                    scope: akash_v1_1.Scope.deployment,
                    xid: "".concat(owner, "/").concat(dseq)
                },
                deposit: {
                    amount: {
                        denom: denom,
                        amount: amount.toString()
                    },
                    sources: [akash_v1_1.Source.grant, akash_v1_1.Source.balance]
                }
            })
        };
    };
    TransactionMessageData.getCloseDeploymentMsg = function (address, dseq) {
        return {
            typeUrl: "/".concat(akash_v1beta4_1.MsgCloseDeployment.$type),
            value: akash_v1beta4_1.MsgCloseDeployment.fromPartial({
                id: {
                    owner: address,
                    dseq: long_1.default.fromString(dseq, true)
                }
            })
        };
    };
    TransactionMessageData.getSendTokensMsg = function (address, recipient, amount) {
        return {
            typeUrl: "/".concat(cosmos_v1beta1_1.MsgSend.$type),
            value: cosmos_v1beta1_1.MsgSend.fromPartial({
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
    };
    TransactionMessageData.getGrantMsg = function (granter, grantee, spendLimit, expiration, denom) {
        return {
            typeUrl: "/".concat(cosmos_v1beta1_2.MsgGrant.$type),
            value: cosmos_v1beta1_2.MsgGrant.fromPartial({
                granter: granter,
                grantee: grantee,
                grant: {
                    authorization: {
                        typeUrl: "/".concat(akash_v1_1.DepositAuthorization.$type),
                        value: akash_v1_1.DepositAuthorization.encode(akash_v1_1.DepositAuthorization.fromPartial({
                            spendLimit: {
                                denom: denom,
                                amount: spendLimit.toString()
                            },
                            scopes: [akash_v1_1.DepositAuthorization_Scope.deployment]
                        })).finish()
                    },
                    expiration: expiration
                }
            })
        };
    };
    TransactionMessageData.getRevokeDepositMsg = function (granter, grantee) {
        return {
            typeUrl: "/".concat(cosmos_v1beta1_2.MsgRevoke.$type),
            value: cosmos_v1beta1_2.MsgRevoke.fromPartial({
                granter: granter,
                grantee: grantee,
                msgTypeUrl: "/".concat(akash_v1_1.MsgAccountDeposit.$type)
            })
        };
    };
    TransactionMessageData.getGrantBasicAllowanceMsg = function (granter, grantee, spendLimit, denom, expiration) {
        var allowance = {
            typeUrl: "/".concat(cosmos_v1beta1_2.BasicAllowance.$type),
            value: Uint8Array.from(cosmos_v1beta1_2.BasicAllowance.encode({
                spendLimit: [
                    {
                        denom: denom,
                        amount: spendLimit.toString()
                    }
                ],
                expiration: expiration
            }).finish())
        };
        return {
            typeUrl: "/".concat(cosmos_v1beta1_2.MsgGrantAllowance.$type),
            value: cosmos_v1beta1_2.MsgGrantAllowance.fromPartial({
                granter: granter,
                grantee: grantee,
                allowance: allowance
            })
        };
    };
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
    TransactionMessageData.getRevokeAllowanceMsg = function (granter, grantee) {
        return {
            typeUrl: "/".concat(cosmos_v1beta1_2.MsgRevokeAllowance.$type),
            value: cosmos_v1beta1_2.MsgRevokeAllowance.fromPartial({
                granter: granter,
                grantee: grantee
            })
        };
    };
    TransactionMessageData.getUpdateProviderMsg = function (owner, hostUri, attributes, info) {
        return {
            typeUrl: "/".concat(akash_v1beta4_2.MsgUpdateProvider.$type),
            value: akash_v1beta4_2.MsgUpdateProvider.fromPartial({
                owner: owner,
                hostUri: hostUri,
                attributes: attributes,
                info: info
            })
        };
    };
    return TransactionMessageData;
}());
exports.TransactionMessageData = TransactionMessageData;
