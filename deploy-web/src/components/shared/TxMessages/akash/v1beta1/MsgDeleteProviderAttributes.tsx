import { AddressLink } from "@src/components/shared/AddressLink";
import { DynamicReactJson } from "@src/components/shared/DynamicJsonView";
import { TransactionMessage } from "@src/types";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { LabelValue } from "../../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgDeleteProviderAttributes: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return <>
    <LabelValue
      label="Provider"
      value={
        <Link href={UrlService.address(message?.data?.owner)}>
          {message?.data?.owner}
        </Link>
      }
    />
    {/* TODO: Add link to provider page */}
    <LabelValue label="Auditor" value={<AddressLink address={message?.data?.auditor} />} />
    <LabelValue label="Keys" value={<DynamicReactJson src={JSON.parse(JSON.stringify(message?.data?.keys))} />} />
  </>;
};
