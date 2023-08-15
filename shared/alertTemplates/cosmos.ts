import { NotificationTemplate } from ".";
import { PropertyTypes } from "../propertyTypes";

export const cosmosAlertTemplates: NotificationTemplate[] = [
  {
    code: "new-proposal",
    name: "New Proposal",
    args: [
      { code: "initialDeposit", label: "Initial Deposit", type: PropertyTypes.Coin },
      { code: "proposer", label: "Proposer", type: PropertyTypes.Address }
    ],
    triggers: [
      {
        type: "/cosmos.gov.v1beta1.MsgSubmitProposal",
        conditions: [
          { key: "initialDeposit", arg: "initialDeposit" },
          { key: "proposer", arg: "proposer" }
        ]
      }
    ]
  },
  {
    code: "new-validator",
    name: "New Validator",
    args: [
      { code: "minSelfDelegation", label: "Min Self Delegation", type: PropertyTypes.DecimalAsString },
      { code: "commissionRate", label: "Commission Rate", type: PropertyTypes.DecimalAsString },
      { code: "commissionMaxRate", label: "Commission Max Rate", type: PropertyTypes.DecimalAsString },
      { code: "commissionMaxChangeRate", label: "Commission Max Rate Change", type: PropertyTypes.DecimalAsString }
    ],
    triggers: [
      {
        type: "/cosmos.staking.v1beta1.MsgCreateValidator",
        conditions: [
          { key: "minSelfDelegation", arg: "minSelfDelegation" },
          { key: "commission.rate", arg: "commissionRate" },
          { key: "commission.maxRate", arg: "commissionMaxRate" },
          { key: "commission.maxRateChange", arg: "commissionMaxRateChange" }
        ]
      }
    ]
  },
  {
    code: "new-delegation",
    name: "Voting Power Added",
    description: "This tracks delegations as well as redelegations.",
    showNoConditionWarning: true,
    args: [
      { code: "delegator", label: "Delegator", type: PropertyTypes.Address },
      { code: "validator", label: "Validator", type: PropertyTypes.ValidatorAddress },
      { code: "amount", label: "Amount", type: PropertyTypes.Coin }
    ],
    triggers: [
      {
        type: "/cosmos.staking.v1beta1.MsgDelegate",
        conditions: [
          { key: "delegatorAddress", arg: "delegator" },
          { key: "validatorAddress", arg: "validator" },
          { key: "amount", arg: "amount" }
        ]
      },
      {
        type: "/cosmos.staking.v1beta1.MsgBeginRedelegate",
        conditions: [
          { key: "delegatorAddress", arg: "delegator" },
          { key: "validatorDstAddress", arg: "validator" },
          { key: "amount", arg: "amount" }
        ]
      }
    ]
  },
  {
    code: "voting-power-removed",
    name: "Voting Power Removed",
    description: "This tracks undelegations as well as redelegations.",
    showNoConditionWarning: true,
    args: [
      { code: "delegator", label: "Delegator", type: PropertyTypes.Address },
      { code: "validator", label: "Validator", type: PropertyTypes.ValidatorAddress },
      { code: "amount", label: "Amount", type: PropertyTypes.Coin }
    ],
    triggers: [
      {
        type: "/cosmos.staking.v1beta1.MsgUndelegate",
        conditions: [
          { key: "delegatorAddress", arg: "delegator" },
          { key: "validatorAddress", arg: "validator" },
          { key: "amount", arg: "amount" }
        ]
      },
      {
        type: "/cosmos.staking.v1beta1.MsgBeginRedelegate",
        conditions: [
          { key: "delegatorAddress", arg: "delegator" },
          { key: "validatorSrcAddress", arg: "validator" },
          { key: "amount", arg: "amount" }
        ]
      }
    ]
  },
  {
    code: "send-tokens",
    name: "Send Tokens",
    showNoConditionWarning: true,
    args: [
      { code: "from", label: "From Address", type: PropertyTypes.Address },
      { code: "to", label: "To Address", type: PropertyTypes.Address },
      { code: "amount", label: "Amount", type: PropertyTypes.Coin }
    ],
    triggers: [
      {
        type: "/cosmos.bank.v1beta1.MsgSend",
        conditions: [
          {
            key: "fromAddress",
            arg: "from"
          },
          {
            key: "toAddress",
            arg: "to"
          },
          {
            key: "amount",
            arg: "amount"
          }
        ]
      }
    ]
  },
  {
    code: "balance-monitor",
    name: "Balance Monitor",
    description: "This alert will trigger when the balance of the specified address is above or below the specified threshold.",
    tracker: "AddressBalanceMonitor",
    args: [
      { code: "address", label: "Address", type: PropertyTypes.Address, operators: ["="] },
      { code: "threshold", label: "Threshold", type: PropertyTypes.Coin }
    ]
  }
];
