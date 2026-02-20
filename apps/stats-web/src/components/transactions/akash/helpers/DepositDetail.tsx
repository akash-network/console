import { type Deposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { Coin } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";

import { AKTAmount } from "@/components/AKTAmount";
import { LabelValue } from "@/components/LabelValue";

const isCoin = (value: unknown): value is Coin => !value || (typeof value === "object" && "denom" in value && "amount" in value);
export const DepositDetail: React.FunctionComponent<{ value: Coin | Deposit }> = ({ value }) => {
  if (isCoin(value)) {
    return <LabelValue label="Deposit" value={<AKTAmount uakt={value?.amount || "0"} showAKTLabel showUSD />} />;
  }

  return (
    <>
      <LabelValue label="Deposit Amount" value={<AKTAmount uakt={value.amount?.amount || "0"} showAKTLabel showUSD />} />
      <LabelValue label="Deposit Sources" value={value.sources.join(", ")} />
    </>
  );
};
