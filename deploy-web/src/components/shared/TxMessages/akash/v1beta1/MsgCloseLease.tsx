import { AddressLink } from "@src/components/shared/AddressLink";
import { TransactionMessage } from "@src/types";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { LabelValue } from "../../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgCloseLease: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.leaseId?.owner} />} />
      <LabelValue
        label="dseq"
        value={
          <Link href={UrlService.publicDeploymentDetails(message?.data?.leaseId?.owner, message?.data?.leaseId?.dseq)}>{message?.data?.leaseId?.dseq}</Link>
        }
      />
      <LabelValue label="gseq" value={message?.data?.leaseId?.gseq} />
      <LabelValue label="oseq" value={message?.data?.leaseId?.oseq} />
      <LabelValue label="Provider" value={<Link href={UrlService.address(message?.data?.leaseId?.provider)}>{message?.data?.leaseId?.provider}</Link>} />
      {/* TODO: Add link to provider page */}
    </>
  );
};
