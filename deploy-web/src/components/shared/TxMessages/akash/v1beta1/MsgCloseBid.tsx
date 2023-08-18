import { AddressLink } from "@src/components/shared/AddressLink";
import { TransactionMessage } from "@src/types";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { LabelValue } from "../../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgCloseBid: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return <>
    <LabelValue
      label="Provider"
      value={
        <Link href={UrlService.address(message?.data?.bidId?.provider)}>
          {message?.data?.bidId?.provider}
        </Link>
      }
    />
    {/* TODO: Add link to provider page */}
    <LabelValue label="Owner" value={<AddressLink address={message?.data?.bidId?.owner} />} />
    <LabelValue
      label="dseq"
      value={
        <Link href={UrlService.publicDeploymentDetails(message?.data?.bidId?.owner, message?.data?.bidId?.dseq)}>
          {message?.data?.bidId?.dseq}
        </Link>
      }
    />
    <LabelValue label="gseq" value={message?.data?.bidId?.gseq} />
    <LabelValue label="oseq" value={message?.data?.bidId?.oseq} />
  </>;
};
