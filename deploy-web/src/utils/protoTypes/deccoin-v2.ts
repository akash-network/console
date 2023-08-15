import { Type, Writer, Reader } from "protobufjs";

// TODO Types
export const DecCoin = new Type("DecCoin") as any;
DecCoin.ctor = function (...args) {
  // console.log("ctor: ", args);
};
DecCoin.encode = function (message, writer) {
  // console.log("Encode: ", message, writer);
  if (!writer) {
    writer = Writer.create();
  }

  if (message.denom !== "") {
    writer.uint32(10).string(message.denom);
  }
  if (message.amount !== "") {
    // https://github.com/cosmos/cosmos-sdk/issues/10863
    let amount = message.amount;
    if (message.amount.includes(".")) {
      const parts = amount.split(".");
      amount = parts[0] + parts[1].padEnd(18, "0");
    } else {
      amount = message.amount.padEnd(message.amount.length + 18, "0");
    }

    writer.uint32(18).string(amount);
  }
  return writer;
};

DecCoin.decode = function (input, length) {
  const reader = input instanceof Reader ? input : new Reader(input);
  let end = length === undefined ? reader.len : reader.pos + length;
  const message = { denom: "", amount: "" };
  while (reader.pos < end) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1:
        message.denom = reader.string();
        break;
      case 2:
        message.amount = reader.string();
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }
  return message;
};
