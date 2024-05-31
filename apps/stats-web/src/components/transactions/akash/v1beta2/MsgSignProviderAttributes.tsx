import { TransactionMessage } from "@/types";
import { UrlService } from "@/lib/urlUtils";
import { AddressLink } from "@/components/AddressLink";
import Link from "next/link";
import { LabelValue } from "../../../LabelValue";
import { DynamicReactJson } from "@/components/DynamicJsonView";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgSignProviderAttributes: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Provider" value={<Link href={UrlService.address(message?.data?.owner)}>{message?.data?.owner}</Link>} />
      {/* TODO: Add link to provider page */}
      <LabelValue label="Auditor" value={<AddressLink address={message?.data?.auditor} />} />
      <LabelValue label="Attributes" value={<DynamicReactJson src={JSON.parse(JSON.stringify(message?.data?.attributes))} />} />
    </>
  );
};
