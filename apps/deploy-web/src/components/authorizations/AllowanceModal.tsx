"use client";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { FormattedDate } from "react-intl";
import { Alert, FormField, FormInput, Popup } from "@akashnetwork/ui/components";
import { EncodeObject } from "@cosmjs/proto-signing";
import { zodResolver } from "@hookform/resolvers/zod";
import { addYears, format } from "date-fns";
import { event } from "nextjs-google-analytics";
import { z } from "zod";

import { LinkTo } from "@src/components/shared/LinkTo";
import { useWallet } from "@src/context/WalletProvider";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { AllowanceType } from "@src/types/grant";
import { AnalyticsEvents } from "@src/utils/analytics";
import { uAktDenom } from "@src/utils/constants";
import { aktToUakt, coinToDenom } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";

type Props = {
  address: string;
  editingAllowance?: AllowanceType | null;
  onClose: () => void;
};

const formSchema = z.object({
  amount: z.number({
    message: "Amount is required."
  }),
  expiration: z
    .string({
      message: "Expiration is required."
    })
    .date(),
  useDepositor: z.boolean(),
  granteeAddress: z.string({ message: "Grantee address is required." })
});

export const AllowanceModal: React.FunctionComponent<Props> = ({ editingAllowance, address, onClose }) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const { signAndBroadcastTx } = useWallet();
  const { handleSubmit, control, watch, clearErrors, setValue } = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      amount: editingAllowance ? coinToDenom(editingAllowance.allowance.spend_limit[0]) : 0,
      expiration: format(addYears(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
      useDepositor: false,
      granteeAddress: editingAllowance?.grantee ?? ""
    },
    resolver: zodResolver(formSchema)
  });
  const { amount, granteeAddress, expiration } = watch();
  const denomData = useDenomData(uAktDenom);

  const onDepositClick = event => {
    event.preventDefault();
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  const onSubmit = async ({ amount, expiration, granteeAddress }: z.infer<typeof formSchema>) => {
    setError("");
    clearErrors();

    const messages: EncodeObject[] = [];
    const spendLimit = aktToUakt(amount);
    const expirationDate = new Date(expiration);

    if (editingAllowance) {
      messages.push(TransactionMessageData.getRevokeAllowanceMsg(address, granteeAddress));
    }
    messages.push(TransactionMessageData.getGrantBasicAllowanceMsg(address, granteeAddress, spendLimit, uAktDenom, expirationDate));
    const response = await signAndBroadcastTx(messages);

    if (response) {
      event(AnalyticsEvents.AUTHORIZE_SPEND, {
        category: "deployments",
        label: "Authorize wallet to spend on deployment deposits"
      });

      onClose();
    }
  };

  function handleDocClick(ev, url: string) {
    ev.preventDefault();

    window.open(url, "_blank");
  }

  const onBalanceClick = () => {
    clearErrors();
    setValue("amount", denomData?.inputMax || 0);
  };

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      actions={[
        {
          label: "Cancel",
          color: "primary",
          variant: "text",
          side: "left",
          onClick: onClose
        },
        {
          label: "Grant",
          color: "secondary",
          variant: "default",
          side: "right",
          disabled: !amount,
          onClick: onDepositClick
        }
      ]}
      onClose={onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick
      title="Authorize Fee Spending"
    >
      <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
        <Alert className="mb-4">
          <p className="text-sm text-muted-foreground">
            <LinkTo onClick={ev => handleDocClick(ev, "https://docs.cosmos.network/v0.46/modules/feegrant/")}>Authorized Fee Spend</LinkTo> allows users to
            authorize spend of a set number of tokens on fees from a source wallet to a destination, funded wallet.
          </p>
        </Alert>

        <div className="mb-2 mt-2 text-right">
          <LinkTo onClick={() => onBalanceClick()}>
            Balance: {denomData?.balance} {denomData?.label}
          </LinkTo>
        </div>

        <div className="mb-4 w-full">
          <FormField
            control={control}
            name="amount"
            render={({ field }) => {
              return (
                <FormInput
                  {...field}
                  type="number"
                  label="Spending Limit"
                  autoFocus
                  min={0}
                  step={0.000001}
                  max={denomData?.inputMax}
                  startIcon={denomData?.label}
                />
              );
            }}
          />
        </div>

        <div className="mb-4 w-full">
          <FormField
            control={control}
            name="granteeAddress"
            render={({ field }) => {
              return <FormInput {...field} type="text" label="Grantee Address" disabled={!!editingAllowance} />;
            }}
          />
        </div>

        <div className="mb-4 w-full">
          <Controller
            control={control}
            name="expiration"
            rules={{
              required: true
            }}
            render={({ field }) => {
              return <FormInput {...field} type="datetime-local" label="Expiration" />;
            }}
          />
        </div>

        {!!amount && granteeAddress && (
          <Alert>
            <p className="text-sm text-muted-foreground">
              This address will be able to spend up to {amount} AKT on <b>transaction fees</b> on your behalf ending on{" "}
              <FormattedDate value={expiration} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />.
            </p>
          </Alert>
        )}

        {error && <Alert variant="warning">{error}</Alert>}
      </form>
    </Popup>
  );
};
