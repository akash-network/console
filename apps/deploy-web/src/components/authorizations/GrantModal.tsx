"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { FormattedDate } from "react-intl";
import {
  Alert,
  Form,
  FormField,
  FormInput,
  FormLabel,
  FormMessage,
  Popup,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { addYears, format } from "date-fns";
import { z } from "zod";

import { LinkTo } from "@src/components/shared/LinkTo";
import { UAKT_DENOM } from "@src/config/denom.config";
import { useWallet } from "@src/context/WalletProvider";
import { getUsdcDenom, useUsdcDenom } from "@src/hooks/useDenom";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { analyticsService } from "@src/services/analytics/analytics.service";
import { GrantType } from "@src/types/grant";
import { denomToUdenom } from "@src/utils/mathHelpers";
import { aktToUakt, coinToDenom } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { handleDocClick } from "@src/utils/urlUtils";

type Props = {
  address: string;
  editingGrant?: GrantType | null;
  onClose: () => void;
};

const supportedTokens = [
  { id: "akt", label: "AKT" },
  { id: "usdc", label: "USDC" }
];

const formSchema = z.object({
  token: z.string().min(1, "Token is required."),
  amount: z.coerce.number().min(0, "Amount must be greater than 0."),
  expiration: z.string().min(1, "Expiration is required."),
  granteeAddress: z.string().min(1, "Grantee address is required.")
});

export const GrantModal: React.FunctionComponent<Props> = ({ editingGrant, address, onClose }) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const { signAndBroadcastTx } = useWallet();
  const usdcDenom = useUsdcDenom();
  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      token: editingGrant ? (editingGrant.authorization.spend_limit.denom === usdcDenom ? "usdc" : "akt") : "akt",
      amount: editingGrant ? coinToDenom(editingGrant.authorization.spend_limit) : 0,
      expiration: format(addYears(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
      granteeAddress: editingGrant?.grantee ?? ""
    },
    resolver: zodResolver(formSchema)
  });
  const { handleSubmit, control, watch, clearErrors, setValue } = form;
  const { amount, granteeAddress, expiration, token } = watch();
  const selectedToken = supportedTokens.find(x => x.id === token);
  const denom = token === "akt" ? UAKT_DENOM : usdcDenom;
  const denomData = useDenomData(denom);

  const onDepositClick = event => {
    event.preventDefault();
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  const onSubmit = async ({ amount, expiration, granteeAddress }: z.infer<typeof formSchema>) => {
    setError("");
    clearErrors();
    const spendLimit = token === "akt" ? aktToUakt(amount) : denomToUdenom(amount);
    const usdcDenom = getUsdcDenom();
    const denom = token === "akt" ? UAKT_DENOM : usdcDenom;

    const expirationDate = new Date(expiration);
    const message = TransactionMessageData.getGrantMsg(address, granteeAddress, spendLimit, expirationDate, denom);
    const response = await signAndBroadcastTx([message]);

    if (response) {
      analyticsService.track("authorize_spend", {
        category: "deployments",
        label: "Authorize wallet to spend on deployment deposits"
      });

      onClose();
    }
  };

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
      title="Authorize Spending"
    >
      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          <Alert className="mb-4">
            <p className="text-sm text-muted-foreground">
              <LinkTo onClick={ev => handleDocClick(ev, "https://akash.network/docs/network-features/authorized-spend/")}>Authorized Spend</LinkTo> allows users
              to authorize spending of a set number of tokens from a source wallet to a destination, funded wallet. The authorized spend is restricted to Akash
              deployment activities and the recipient of the tokens would not have access to those tokens for other operations.
            </p>
          </Alert>

          <div className="mb-2 mt-2 text-right">
            <LinkTo onClick={() => onBalanceClick()}>
              Balance: {denomData?.balance} {denomData?.label}
            </LinkTo>
          </div>

          <div className="mb-4 flex w-full flex-row items-center">
            <FormField
              control={control}
              name="token"
              render={({ field }) => {
                return (
                  <div>
                    <FormLabel htmlFor="grant-address">Token</FormLabel>
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger id="grant-address">
                        <SelectValue placeholder="Select grant token" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {supportedTokens.map(token => (
                            <SelectItem key={token.id} value={token.id}>
                              {token.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    <FormMessage />
                  </div>
                );
              }}
            />

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
                    className="ml-4 flex-grow"
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
                return <FormInput {...field} type="text" label="Grantee Address" disabled={!!editingGrant} />;
              }}
            />
          </div>

          <div className="mb-4 w-full">
            <FormField
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
                This address will be able to spend up to {amount} {selectedToken?.label} on your behalf ending on{" "}
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
