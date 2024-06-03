import Link from "next/link";

import { LabelValue } from "../../../LabelValue";

import { AddressLink } from "@/components/AddressLink";
import { AKTAmount } from "@/components/AKTAmount";
import { DynamicReactJson } from "@/components/DynamicJsonView";
import { coinsToAmount } from "@/lib/mathHelpers";
import { UrlService } from "@/lib/urlUtils";
import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgCreateDeployment: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO group resources from base 64
  // ###################
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.id?.owner} />} />
      <LabelValue
        label="dseq"
        value={<Link href={UrlService.deployment(message?.data?.id?.owner, message?.data?.id?.dseq)}>{message?.data?.id?.dseq}</Link>}
      />
      <LabelValue label="Version" value={message?.data?.version} />
      <LabelValue label="Depositor" value={<Link href={UrlService.address(message?.data?.depositor)}>{message?.data?.depositor}</Link>} />
      <LabelValue label="Deposit" value={<AKTAmount uakt={coinsToAmount(message?.data?.deposit, "uakt")} showAKTLabel showUSD />} />
      <LabelValue label="Groups" value={<DynamicReactJson src={JSON.parse(JSON.stringify(message?.data?.groups))} />} />
    </>
  );
};
