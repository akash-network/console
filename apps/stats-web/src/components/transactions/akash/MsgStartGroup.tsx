import { Link } from "react-router-dom";

import { LabelValue } from "../../LabelValue";
import { createMsgView } from "../createMsgView";

import { AddressLink } from "@/components/AddressLink";
import { UrlService } from "@/lib/urlUtils";

export const MsgStartGroup = createMsgView(["v1beta1", "v1beta2", "v1beta3", "v1beta4"], ({ message }) => {
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.id?.owner} />} />
      <LabelValue label="dseq" value={<Link to={UrlService.deployment(message?.data?.id?.owner, message?.data?.id?.dseq)}>{message?.data?.id?.dseq}</Link>} />
      <LabelValue label="gseq" value={message?.data?.id?.gseq} />
    </>
  );
});
