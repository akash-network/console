import { TransactionMessage } from "@src/types";
import { AddressLink } from "../../AddressLink";
import { AKTLabel } from "../../AKTLabel";
import { LabelValue } from "../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgEditValidator: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO missing commissionRate, minSelfDelegation + validator moniker
  // ###################

  return (
    <>
      <LabelValue label="Validator Address" value={<AddressLink address={message?.data?.validatorAddress} />} />
      <LabelValue label="Details" value={message?.data?.description?.details} />
      <LabelValue label="Moniker" value={message?.data?.description?.moniker} />
      <LabelValue
        label="Website"
        value={
          message?.data?.description?.website && message?.data?.description?.website !== "[do-not-modify]" ? (
            <a href={message?.data?.description?.website} target="_blank">
              {message?.data?.description?.website}
            </a>
          ) : (
            <>{message?.data?.description?.website}</>
          )
        }
      />
      <LabelValue label="Identity" value={message?.data?.description?.identity} />
      <LabelValue label="Security Contact" value={message?.data?.description?.securityContact} />
      <LabelValue label="Commission Rate" value={message?.data?.commissionRate} />
      <LabelValue
        label="Min Self Delegation"
        value={
          <>
            {typeof message?.data?.minSelfDelegation === "number" && (
              <>
                {message?.data?.minSelfDelegation}&nbsp;
                <AKTLabel />
              </>
            )}
          </>
        }
      />
    </>
  );
};
