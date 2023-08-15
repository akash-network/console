import { NotificationTemplate } from ".";
import { CustomContractTypePropertyKey } from "../msgSchemas/cosmosSchemas";
import { PropertyTypes } from "../propertyTypes";

const NFTMarketplaceContractAddress = "stars1fvhcnyddukcqfnt7nlwv3thm5we22lyxyxylr9h77cvgkcn43xfsvgv0pl";

export const stargazeAlertTemplates: NotificationTemplate[] = [
  {
    //https://www.mintscan.io/stargaze/txs/FF294515CDAAB58E4D4AF37C7EE8118C11D64289555129ED19BBE2863983C0E0
    code: "stargaze-new-offer",
    name: "New Offer",
    args: [
      { code: "collection", label: "Collection", type: PropertyTypes.ContractAddress, required: true },
      { code: "tokenId", label: "Token ID", type: PropertyTypes.Integer, operators: ["="], required: true },
      { code: "price", label: "Price", type: PropertyTypes.Coin }
    ],
    triggers: [
      {
        type: "/cosmwasm.wasm.v1.MsgExecuteContract",
        conditions: [
          { key: "contract", value: NFTMarketplaceContractAddress },
          { key: CustomContractTypePropertyKey, value: "set_bid" },
          { key: "msg.collection", arg: "collection" },
          { key: "msg.token_id", arg: "tokenId" },
          { key: "funds", arg: "price" }
        ]
      }
    ]
  },
  {
    //https://www.mintscan.io/stargaze/txs/B5651967FF6B9E95D2C88D2890134254DE3FB226166897B7007AC9810826EBB9
    code: "stargaze-listed-for-sale",
    name: "Listed for sale",
    args: [
      { code: "collection", label: "Collection", type: PropertyTypes.ContractAddress, required: true },
      { code: "tokenId", label: "Token ID", type: PropertyTypes.Integer, operators: ["="], required: true },
      { code: "price", label: "Price", type: PropertyTypes.Coin }
    ],
    triggers: [
      {
        type: "/cosmwasm.wasm.v1.MsgExecuteContract",
        conditions: [
          { key: "contract", value: NFTMarketplaceContractAddress },
          { key: CustomContractTypePropertyKey, value: "set_ask" },
          { key: "msg.collection", arg: "collection" },
          { key: "msg.token_id", arg: "tokenId" },
          { key: "msg.price", arg: "price" }
        ]
      }
    ]
  },
  {
    //https://www.mintscan.io/stargaze/txs/B4E6FCFC2082925758300ACF0A64A6B8D7959E9A58ADE76B47E5D79B36E81D17
    code: "stargaze-ask-price-updated",
    name: "Price changed",
    args: [
      { code: "collection", label: "Collection", type: PropertyTypes.ContractAddress, required: true },
      { code: "tokenId", label: "Token ID", type: PropertyTypes.Integer, operators: ["="], required: true },
      { code: "price", label: "Price", type: PropertyTypes.Coin }
    ],
    triggers: [
      {
        type: "/cosmwasm.wasm.v1.MsgExecuteContract",
        conditions: [
          { key: "contract", value: NFTMarketplaceContractAddress },
          { key: CustomContractTypePropertyKey, value: "update_ask_price" },
          { key: "msg.collection", arg: "collection" },
          { key: "msg.token_id", arg: "tokenId" },
          { key: "msg.price", arg: "price" }
        ]
      }
    ]
  }
];
