import { IMessageSchema } from ".";
import { PropertyTypes } from "../propertyTypes";
export const CustomContractTypePropertyKey = "__CONTRACT_TYPE__";

export const stargazeSchemas: IMessageSchema[] = [
  {
    type: "/cosmwasm.wasm.v1.MsgExecuteContract",
    disableCustomAlerts: true,
    showNoConditionWarning: true,
    properties: {
      sender: PropertyTypes.Address,
      contract: PropertyTypes.String,
      [CustomContractTypePropertyKey]: PropertyTypes.String,
      msg: {
        set_bid: {
          collection: PropertyTypes.ContractAddress,
          expires: PropertyTypes.TimestampNano,
          token_id: PropertyTypes.IntegerAsString,
          sale_type: PropertyTypes.String
        },
        set_ask: {
          collection: PropertyTypes.ContractAddress,
          expires: PropertyTypes.TimestampNano,
          sale_type: PropertyTypes.String,
          reserve_for: PropertyTypes.Address,
          funds_recipient: PropertyTypes.Address,
          price: PropertyTypes.Coin,
          token_id: PropertyTypes.IntegerAsString
        },
        update_ask_price: {
          collection: PropertyTypes.ContractAddress,
          price: PropertyTypes.Coin,
          token_id: PropertyTypes.IntegerAsString
        }
      },
      funds: PropertyTypes.Coin
    }
  }
];
