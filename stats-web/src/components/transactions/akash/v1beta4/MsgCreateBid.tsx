import { TransactionMessage } from "@/types";
import { UrlService } from "@/lib/urlUtils";
import { AddressLink } from "@/components/AddressLink";
import Link from "next/link";
import { LabelValue } from "@/components/LabelValue";
import { AKTAmount } from "@/components/AKTAmount";
import { coinsToAmount } from "@/lib/mathHelpers";
import { DynamicReactJson } from "@/components/DynamicJsonView";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgCreateBid: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Provider" value={<Link href={UrlService.address(message?.data?.provider)}>{message?.data?.provider}</Link>} />
      {/* TODO: Add link to provider page */}
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.order?.owner} />} />
      <LabelValue
        label="dseq"
        value={<Link href={UrlService.publicDeploymentDetails(message?.data?.order?.owner, message?.data?.order?.dseq)}>{message?.data?.order?.dseq}</Link>}
      />
      <LabelValue label="gseq" value={message?.data?.order?.gseq} />
      <LabelValue label="oseq" value={message?.data?.order?.oseq} />
      <LabelValue label="Price" value={<AKTAmount uakt={coinsToAmount(message?.data?.price, "uakt")} showAKTLabel showUSD />} />
      <LabelValue label="Deposit" value={<AKTAmount uakt={coinsToAmount(message?.data?.deposit, "uakt")} showAKTLabel showUSD />} />
      <LabelValue label="Resources Offer" value={<DynamicReactJson src={JSON.parse(JSON.stringify(message?.data?.resourcesOffer))} />} />
    </>
  );
};
