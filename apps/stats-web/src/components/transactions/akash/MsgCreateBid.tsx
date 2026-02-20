import { Link } from "react-router-dom";

import { LabelValue } from "../../LabelValue";
import { createMsgView } from "../createMsgView";
import { DepositDetail } from "./helpers/DepositDetail";

import { AddressLink } from "@/components/AddressLink";
import { AKTAmount } from "@/components/AKTAmount";
import { DynamicReactJson } from "@/components/DynamicJsonView";
import { coinsToAmount } from "@/lib/mathHelpers";
import { UrlService } from "@/lib/urlUtils";

export const MsgCreateBid = createMsgView(["v1beta1", "v1beta2", "v1beta3", "v1beta4", "v1beta5"], ({ message }) => {
  const order = message?.data?.id || message?.data?.order;
  return (
    <>
      <LabelValue label="Provider" value={<Link to={UrlService.address(message?.data?.provider)}>{message?.data?.provider}</Link>} />
      {/* TODO: Add link to provider page */}
      <LabelValue label="Owner" value={<AddressLink address={order?.owner} />} />
      <LabelValue label="dseq" value={<Link to={UrlService.deployment(order?.owner, order?.dseq)}>{order?.dseq}</Link>} />
      <LabelValue label="gseq" value={order?.gseq} />
      <LabelValue label="oseq" value={order?.oseq} />
      <LabelValue label="Price" value={<AKTAmount uakt={coinsToAmount(message?.data?.price, "uakt")} showAKTLabel showUSD />} />
      <DepositDetail value={message?.data?.deposit} />
      {message?.data?.resourcesOffer && (
        <LabelValue label="Resources Offer" value={<DynamicReactJson src={JSON.parse(JSON.stringify(message?.data?.resourcesOffer))} />} />
      )}{" "}
      {/* from v1beta4 */}
    </>
  );
});
