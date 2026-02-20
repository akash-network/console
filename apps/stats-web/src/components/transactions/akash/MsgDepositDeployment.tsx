import { Link } from "react-router-dom";

import { LabelValue } from "../../LabelValue";
import { createMsgView } from "../createMsgView";

import { AddressLink } from "@/components/AddressLink";
import { AKTAmount } from "@/components/AKTAmount";
import { coinsToAmount } from "@/lib/mathHelpers";
import { UrlService } from "@/lib/urlUtils";

export const MsgDepositDeployment = createMsgView(["v1beta1", "v1beta2", "v1beta3"], ({ message }) => {
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.id?.owner} />} />
      <LabelValue label="DSEQ" value={<Link to={UrlService.deployment(message?.data?.id?.owner, message?.data?.id?.dseq)}>{message?.data?.id?.dseq}</Link>} />
      {message?.data?.depositor && <LabelValue label="Depositor" value={<AddressLink address={message?.data?.depositor} />} />}
      <LabelValue label="Deposit" value={<AKTAmount uakt={coinsToAmount(message?.data?.amount, "uakt")} showAKTLabel showUSD />} />
    </>
  );
});
