import { AddressLink } from "../../AddressLink";
import { AKTAmount } from "../../AKTAmount";
import { LabelValue } from "../../LabelValue";

import { coinsToAmount } from "@/lib/mathHelpers";
import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgMultiSend: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  const senders = message.data?.inputs.map((input: any) => (
    <div key={input.address}>
      <AddressLink address={input.address} />
      &nbsp;
      <span className="text-muted-foreground text-xs">
        (<AKTAmount uakt={coinsToAmount(input.coins, "uakt")} showAKTLabel />
      </span>
    </div>
  ));
  const receivers = message.data?.outputs.map((output: any) => (
    <div key={output.address}>
      <AddressLink address={output.address} />
      &nbsp;
      <span className="text-muted-foreground text-xs">
        (<AKTAmount uakt={coinsToAmount(output.coins, "uakt")} showAKTLabel />)
      </span>
    </div>
  ));
  return (
    <>
      <LabelValue label="Senders" value={senders} />
      <LabelValue label="Receivers" value={receivers} />
    </>
  );
};
