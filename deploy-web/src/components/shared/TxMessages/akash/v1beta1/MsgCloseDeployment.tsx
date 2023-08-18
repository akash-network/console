import { AddressLink } from "@src/components/shared/AddressLink";
import { TransactionMessage } from "@src/types";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { LabelValue } from "../../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgCloseDeployment: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return <>
    <LabelValue label="Owner" value={<AddressLink address={message?.data?.id?.owner} />} />
    <LabelValue
      label="dseq"
      value={
        <Link href={UrlService.publicDeploymentDetails(message?.data?.id?.owner, message?.data?.id?.dseq)}>
          {message?.data?.id?.dseq}
        </Link>
      }
    />
  </>;
};
