import { AddressLink } from "@src/components/shared/AddressLink";
import { AKTAmount } from "@src/components/shared/AKTAmount";
import { DynamicReactJson } from "@src/components/shared/DynamicJsonView";
import { TransactionMessage } from "@src/types";
import { coinsToAmount } from "@src/utils/mathHelpers";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { LabelValue } from "../../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgCreateDeployment: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO group resources from base 64
  // ###################
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.id?.owner} />} />
      <LabelValue
        label="dseq"
        value={
          <Link href={UrlService.publicDeploymentDetails(message?.data?.id?.owner, message?.data?.id?.dseq)}>
            <a>{message?.data?.id?.dseq}</a>
          </Link>
        }
      />
      <LabelValue label="Version" value={message?.data?.version} />
      <LabelValue label="Deposit" value={<AKTAmount uakt={coinsToAmount(message?.data?.deposit, "uakt")} showAKTLabel showUSD />} />
      <LabelValue label="Groups" value={<DynamicReactJson src={JSON.parse(JSON.stringify(message?.data?.groups))} />} />
    </>
  );
};
