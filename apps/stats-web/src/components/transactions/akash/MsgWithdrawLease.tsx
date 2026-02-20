import { Link } from "react-router-dom";

import { LabelValue } from "../../LabelValue";
import { createMsgView } from "../createMsgView";

import { AddressLink } from "@/components/AddressLink";
import { UrlService } from "@/lib/urlUtils";

export const MsgWithdrawLease = createMsgView(["v1beta1", "v1beta2", "v1beta3", "v1beta4", "v1beta5"], ({ message }) => {
  const bidId = message?.data?.id || message?.data?.bidId;
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={bidId?.owner} />} />
      <LabelValue label="Provider" value={<Link to={UrlService.address(bidId?.provider)}>{bidId?.provider}</Link>} />
      <LabelValue label="dseq" value={<Link to={UrlService.deployment(bidId?.owner, bidId?.dseq)}>{bidId?.dseq}</Link>} />
      <LabelValue label="gseq" value={bidId?.gseq} />
      <LabelValue label="oseq" value={bidId?.oseq} />
    </>
  );
});
