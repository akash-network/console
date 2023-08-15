import { IMessageSchema } from ".";
import { PropertyTypes } from "../propertyTypes";
export const CustomContractTypePropertyKey = "__CONTRACT_TYPE__";

export const cosmosSchemas: IMessageSchema[] = [
  {
    type: "/cosmos.bank.v1beta1.MsgSend",
    showNoConditionWarning: true,
    properties: {
      fromAddress: PropertyTypes.Address,
      toAddress: PropertyTypes.Address,
      amount: PropertyTypes.Coin
    }
  },
  {
    type: "/cosmos.bank.v1beta1.MsgMultiSend",
    showNoConditionWarning: true,
    properties: {
      inputs: [
        {
          address: PropertyTypes.Address,
          coins: PropertyTypes.Coin
        }
      ],
      outputs: [
        {
          address: PropertyTypes.Address,
          coins: PropertyTypes.Coin
        }
      ]
    }
  },
  {
    type: "/cosmos.gov.v1beta1.MsgSubmitProposal",
    properties: {
      initialDeposit: PropertyTypes.Coin,
      proposer: PropertyTypes.Address
    }
  },
  {
    type: "/cosmos.staking.v1beta1.MsgCreateValidator",
    properties: {
      minSelfDelegation: PropertyTypes.DecimalAsString,
      delegatorAddress: PropertyTypes.Address,
      validatorAddress: PropertyTypes.ValidatorAddress,
      value: PropertyTypes.Coin,
      description: {
        details: PropertyTypes.String,
        moniker: PropertyTypes.String,
        website: PropertyTypes.String,
        identity: PropertyTypes.String,
        securityContact: PropertyTypes.String
      },
      commission: {
        rate: PropertyTypes.DecimalAsString,
        maxRate: PropertyTypes.DecimalAsString,
        maxChangeRate: PropertyTypes.DecimalAsString
      }
      //pubkey
    }
  },
  {
    type: "/cosmos.staking.v1beta1.MsgDelegate",
    showNoConditionWarning: true,
    properties: {
      delegatorAddress: PropertyTypes.Address,
      validatorAddress: PropertyTypes.ValidatorAddress,
      amount: PropertyTypes.Coin
    }
  },
  {
    type: "/cosmos.staking.v1beta1.MsgBeginRedelegate",
    showNoConditionWarning: true,
    properties: {
      delegatorAddress: PropertyTypes.Address,
      validatorSrcAddress: PropertyTypes.ValidatorAddress,
      validatorDstAddress: PropertyTypes.ValidatorAddress,
      amount: PropertyTypes.Coin
    }
  },
  {
    type: "/cosmos.staking.v1beta1.MsgUndelegate",
    showNoConditionWarning: true,
    properties: {
      delegatorAddress: PropertyTypes.Address,
      validatorAddress: PropertyTypes.ValidatorAddress,
      amount: PropertyTypes.Coin
    }
  }
];
