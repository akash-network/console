"use client";
import { AddressLink } from "../../AddressLink";
import { LabelValue } from "../../LabelValue";

import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgRecvPacket: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO missing amount, originAmount, originDenom, receiver, sender, effected
  // ###################

  return (
    <>
      <LabelValue label="Sequence" value={message?.data?.packet?.sequence} />
      {/* <MessageLabelValue
        label="Amount"
        value={
          <>
            TODO
            <AKTLabel />
          </>
        }
      />
      <MessageLabelValue
        label="Origin Amount"
        value={
          <>
            TODO
            <AKTLabel />
          </>
        }
      />
      <MessageLabelValue
        label="Origin Denom"
        value={
          <>
            TODO
            <AKTLabel />
          </>
        }
      /> */}
      <LabelValue label="Source Port" value={message?.data?.packet?.sourcePort} />
      <LabelValue label="Source Channel" value={message?.data?.packet?.sourceChannel} />
      <LabelValue label="Destination Port" value={message?.data?.packet?.destinationPort} />
      <LabelValue label="Destination Channel" value={message?.data?.packet?.destinationChannel} />
      <LabelValue label="Signer" value={<AddressLink address={message?.data?.signer} />} />
      {/* <MessageLabelValue
        label="Receiver"
        value={
          <Link href={UrlService.address(message?.data?.signer)}>
            <a>{message?.data?.signer}</a>
          </Link>
        }
      />
      <MessageLabelValue
        label="Sender"
        value={
          <Link href={UrlService.address(message?.data?.signer)}>
            <a>{message?.data?.signer}</a>
          </Link>
        }
      /> */}
      <LabelValue label="Effected" value={message?.data?.effected} />
    </>
  );
};
