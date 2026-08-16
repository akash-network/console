import "./legacy-dec-coin-precision";

import { MsgCreateBid } from "@akashnetwork/akash-api/akash/market/v1beta2";
import { DecCoin } from "@akashnetwork/akash-api/cosmos/base/v1beta1";
import { describe, expect, it } from "vitest";

describe("legacy DecCoin precision", () => {
  it.each([
    ["117.73952", "117.73952"],
    ["100", "100"],
    ["0.5", "0.5"],
    ["0", "0"],
    ["1000000", "1000000"],
    ["0.000000000000000001", "0.000000000000000001"],
    ["123456789.123456789123456789", "123456789.123456789123456789"]
  ])("round-trips %s exactly instead of float-approximating it", (amount, expected) => {
    const bytes = DecCoin.encode({ $type: DecCoin.$type, denom: "uakt", amount }).finish();

    expect(DecCoin.decode(bytes)).toEqual({ $type: DecCoin.$type, denom: "uakt", amount: expected });
  });

  it("decodes DecCoins nested inside legacy messages exactly", () => {
    const message = MsgCreateBid.fromPartial({ price: { denom: "uakt", amount: "117.73952" } });
    const bytes = MsgCreateBid.encode(message).finish();

    expect(MsgCreateBid.decode(bytes).price?.amount).toBe("117.73952");
  });
});
