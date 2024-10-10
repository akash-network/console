"use client";
import { useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { FormattedDate } from "react-intl";
import { Alert, Form, FormField, FormInput, Popup } from "@akashnetwork/ui/components";
import { EncodeObject } from "@cosmjs/proto-signing";
import { zodResolver } from "@hookform/resolvers/zod";
import { addYears, format } from "date-fns";
import { event } from "nextjs-google-analytics";
import { z } from "zod";

import { LinkTo } from "@src/components/shared/LinkTo";
import { UAKT_DENOM } from "@src/config/denom.config";
import { useWallet } from "@src/context/WalletProvider";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { AllowanceType } from "@src/types/grant";
import { AnalyticsEvents } from "@src/utils/analytics";
import { aktToUakt, coinToDenom } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";

type Props = {
  address: string;
  editingAllowance?: AllowanceType | null;
  onClose: () => void;
};

const formSchema = z.object({
  amount: z.coerce.number().min(0, {
    message: "Amount must be greater than 0."
  }),
  expiration: z.string().min(1, "Expiration is required."),
  granteeAddress: z.string().min(1, "Grantee address is required.")
});

export const AllowanceModal: React.FunctionComponent<Props> = ({ editingAllowance, address, onClose }) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const { signAndBroadcastTx } = useWallet();
  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      amount: editingAllowance ? coinToDenom(editingAllowance.allowance.spend_limit[0]) : 0,
      expiration: format(addYears(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
      granteeAddress: editingAllowance?.grantee ?? ""
    },
    resolver: zodResolver(formSchema)
  });
  const { handleSubmit, control, watch, clearErrors, setValue } = form;
  const { amount, granteeAddress, expiration } = watch();
  const denomData = useDenomData(UAKT_DENOM);

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
    messages.push(TransactionMessageData.getGrantBasicAllowanceMsg(address, granteeAddress, spendLimit, UAKT_DENOM, expirationDate));
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
    setValue("amount", denomData?.max || 0);
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
      <Form {...form}>
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
                    max={denomData?.max}
                    startIcon={<span className="pl-2 text-xs">{denomData?.label}</span>}
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
      </Form>
    </Popup>
  );
};
