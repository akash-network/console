import { LabelValue } from "../../LabelValue";
import { createMsgView } from "../createMsgView";

import { AddressLink } from "@/components/AddressLink";
import { DynamicReactJson } from "@/components/DynamicJsonView";

export const MsgUpdateProvider = createMsgView(["v1beta1", "v1beta2", "v1beta3", "v1beta4"], ({ message }) => {
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.owner} />} />
      <LabelValue label="Host Uri" value={message?.data?.hostUri} />
      <LabelValue label="Attributes" value={<DynamicReactJson src={JSON.parse(JSON.stringify(message?.data?.attributes))} />} />
      <LabelValue label="Email" value={message?.data?.info?.email} />
      <LabelValue label="Website" value={message?.data?.info?.website} />
    </>
  );
});
