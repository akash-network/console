import { MsgAccountDeposit, MsgMintACT, Scope, Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment, MsgUpdateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { MsgSend } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";

import type { BidDto, NewDeploymentData } from "@src/types/deployment";

export class TransactionMessageData {
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
}
