import { Link } from "react-router-dom";

import { LabelValue } from "../../LabelValue";
import { createMsgView } from "../createMsgView";

import { AddressLink } from "@/components/AddressLink";
import { UrlService } from "@/lib/urlUtils";

export const MsgCloseLease = createMsgView(["v1beta1", "v1beta2", "v1beta3", "v1beta4", "v1beta5"], ({ message }) => {
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.leaseId?.owner} />} />
      <LabelValue
        label="dseq"
        value={<Link to={UrlService.deployment(message?.data?.leaseId?.owner, message?.data?.leaseId?.dseq)}>{message?.data?.leaseId?.dseq}</Link>}
      />
      <LabelValue label="gseq" value={message?.data?.leaseId?.gseq} />
      <LabelValue label="oseq" value={message?.data?.leaseId?.oseq} />
      <LabelValue label="Provider" value={<Link to={UrlService.address(message?.data?.leaseId?.provider)}>{message?.data?.leaseId?.provider}</Link>} />
      {/* TODO: Add link to provider page */}
    </>
  );
});
