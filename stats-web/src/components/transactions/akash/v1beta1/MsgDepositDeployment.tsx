import { TransactionMessage } from "@/types";
import { UrlService } from "@/lib/urlUtils";
import { AddressLink } from "@/components/AddressLink";
import Link from "next/link";
import { LabelValue } from "../../../LabelValue";
import { AKTAmount } from "@/components/AKTAmount";
import { coinsToAmount } from "@/lib/mathHelpers";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgDepositDeployment: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.id?.owner} />} />
      <LabelValue
        label="DSEQ"
        value={<Link href={UrlService.deployment(message?.data?.id?.owner, message?.data?.id?.dseq)}>{message?.data?.id?.dseq}</Link>}
      />
      <LabelValue label="Deposit" value={<AKTAmount uakt={coinsToAmount(message?.data?.amount, "uakt")} showAKTLabel showUSD />} />
    </>
  );
};
