import { AddressLink } from "../../AddressLink";
import { LabelValue } from "../../LabelValue";

import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgWithdrawDelegatorReward: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO Missing amount + validator moniker
  // ###################
  return (
    <>
      <LabelValue label="Delegator Address" value={<AddressLink address={message?.data?.delegatorAddress} />} />
      <LabelValue label="Validator Address" value={<AddressLink address={message?.data?.validatorAddress} />} />
      {/* <MessageLabelValue label="Amount" value={"TODO"} /> */}
    </>
  );
};
