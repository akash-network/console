import Typography from "@mui/material/Typography";
import { TransactionMessage } from "@src/types";
import { coinsToAmount } from "@src/utils/mathHelpers";
import { AddressLink } from "../../AddressLink";
import { AKTAmount } from "../../AKTAmount";
import { LabelValue } from "../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgMultiSend: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  const senders = message.data?.inputs.map(input => (
    <div key={input.address}>
      <AddressLink address={input.address} />
      &nbsp;
      <Typography variant="caption">
        (<AKTAmount uakt={coinsToAmount(input.coins, "uakt")} showAKTLabel />
      </Typography>
    </div>
  ));
  const receivers = message.data?.outputs.map(output => (
    <div key={output.address}>
      <AddressLink address={output.address} />
      &nbsp;
      <Typography variant="caption">
        (<AKTAmount uakt={coinsToAmount(output.coins, "uakt")} showAKTLabel />)
      </Typography>
    </div>
  ));
  return (
    <>
      <LabelValue label="Senders" value={senders} />
      <LabelValue label="Receivers" value={receivers} />
    </>
  );
};
