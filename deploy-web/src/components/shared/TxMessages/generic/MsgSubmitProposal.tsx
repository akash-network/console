import { TransactionMessage } from "@src/types";
import { coinsToAmount } from "@src/utils/mathHelpers";
import { getFriendlyProposalType } from "@src/utils/proposals";
import { AddressLink } from "../../AddressLink";
import { AKTAmount } from "../../AKTAmount";
import { LabelValue } from "../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgSubmitProposal: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO Missing ProposalId, ProposalType, Title
  // ###################
  return (
    <>
      <LabelValue label="Initial Deposit" value={<AKTAmount uakt={coinsToAmount(message?.data?.initialDeposit, "uakt")} showAKTLabel showUSD />} />
      <LabelValue label="Proposer" value={<AddressLink address={message?.data?.proposer} />} />
      {/* <MessageLabelValue
        label="Proposal Id"
        value={
          <Link href="TODO">
            <a>{message?.data?.proposalId}</a>
          </Link>
        }
      /> */}
      <LabelValue label="Proposal Type" value={getFriendlyProposalType(message?.data?.content.typeUrl)} />
      {/* <MessageLabelValue label="Title" value={"TODO"} /> */}
    </>
  );
};
