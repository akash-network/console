"use client";
import { useMemo, useRef, useState } from "react";
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
import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { useSupportsACT } from "@src/hooks/useSupportsACT/useSupportsACT";
import { useDenomData } from "@src/hooks/useWalletBalance";
import type { GrantType } from "@src/types/grant";
import { denomToUdenom } from "@src/utils/mathHelpers";
import { coinToDenom } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { handleDocClick } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
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
  SelectValue,
  FormattedDate,
  LinkTo,
  useServices,
  useWallet,
  useUsdcDenom,
  useDenomData,
  useSupportsACT
};

type Props = {
  address: string;
  editingGrant?: GrantType | null;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

const formSchema = z.object({
  token: z.string().min(1, "Token is required."),
  amount: z.coerce.number().min(0, "Amount must be greater than 0."),
  expiration: z.string().min(1, "Expiration is required."),
  granteeAddress: z.string().min(1, "Grantee address is required.")
});

export const GrantModal: React.FunctionComponent<Props> = ({ editingGrant, address, onClose, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = d.useServices();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const { signAndBroadcastTx } = d.useWallet();
  const usdcDenom = d.useUsdcDenom();
  const isACTSupported = d.useSupportsACT();
  const defaultToken = isACTSupported ? UACT_DENOM : UAKT_DENOM;
  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      token: editingGrant?.authorization.spend_limits[0]?.denom === usdcDenom ? "usdc" : defaultToken,
      amount: editingGrant ? coinToDenom(editingGrant.authorization.spend_limits[0]) : 0,
      expiration: format(addYears(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
      granteeAddress: editingGrant?.grantee ?? ""
    },
    resolver: zodResolver(formSchema)
  });
  const { handleSubmit, control, watch, clearErrors, setValue } = form;
  const { amount, granteeAddress, expiration, token } = watch();
  const denom = token === "usdc" ? usdcDenom : token;
  const denomData = d.useDenomData(denom);
  const supportedTokens = useMemo(() => {
    if (isACTSupported) {
      return [
        { id: UACT_DENOM, label: "ACT" },
        { id: UAKT_DENOM, label: "AKT" }
      ];
    }

    return [
      { id: UAKT_DENOM, label: "AKT" },
      { id: "usdc", label: "USDC" }
    ];
  }, [isACTSupported]);
  const selectedToken = supportedTokens.find(x => x.id === token);

  const onDepositClick = (event: React.MouseEvent) => {
    event.preventDefault();
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  const onSubmit = async ({ amount, expiration, granteeAddress }: z.infer<typeof formSchema>) => {
    setError("");
    clearErrors();
    const denom = token === "usdc" ? usdcDenom : token;
    const limit = { amount: denomToUdenom(amount).toString(), denom };
    const spendLimit = isACTSupported ? [limit] : limit;

    const expirationDate = new Date(expiration);
    const message = TransactionMessageData.getGrantMsg(address, granteeAddress, spendLimit, expirationDate);
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
    <d.Popup
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
      <d.Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          <d.Alert className="mb-4">
            <p className="text-sm text-muted-foreground">
              <d.LinkTo onClick={ev => handleDocClick(ev, "https://akash.network/docs/network-features/authorized-spend/")}>Authorized Spend</d.LinkTo> allows
              users to authorize spending of a set number of tokens from a source wallet to a destination, funded wallet. The authorized spend is restricted to
              Akash deployment activities and the recipient of the tokens would not have access to those tokens for other operations.
            </p>
          </d.Alert>

          <div className="mb-2 mt-2 text-right">
            <d.LinkTo onClick={() => onBalanceClick()}>
              Balance: {denomData?.balance} {denomData?.label}
            </d.LinkTo>
          </div>

          <div className="mb-4 flex w-full flex-row items-center">
            <d.FormField
              control={control}
              name="token"
              render={({ field }) => {
                return (
                  <div>
                    <d.FormLabel htmlFor="grant-address">Token</d.FormLabel>
                    <d.Select value={field.value || ""} onValueChange={field.onChange}>
                      <d.SelectTrigger id="grant-address">
                        <d.SelectValue placeholder="Select grant token" />
                      </d.SelectTrigger>
                      <d.SelectContent>
                        <d.SelectGroup>
                          {supportedTokens.map(token => (
                            <d.SelectItem key={token.id} value={token.id}>
                              {token.label}
                            </d.SelectItem>
                          ))}
                        </d.SelectGroup>
                      </d.SelectContent>
                    </d.Select>

                    <d.FormMessage />
                  </div>
                );
              }}
            />

            <d.FormField
              control={control}
              name="amount"
              render={({ field }) => {
                return (
                  <d.FormInput
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
            <d.FormField
              control={control}
              name="granteeAddress"
              render={({ field }) => {
                return <d.FormInput {...field} type="text" label="Grantee Address" disabled={!!editingGrant} />;
              }}
            />
          </div>

          <div className="mb-4 w-full">
            <d.FormField
              control={control}
              name="expiration"
              render={({ field }) => {
                return <d.FormInput {...field} type="datetime-local" label="Expiration" />;
              }}
            />
          </div>

          {!!amount && granteeAddress && (
            <d.Alert>
              <p className="text-sm text-muted-foreground">
                This address will be able to spend up to {amount} {selectedToken?.label} on your behalf ending on{" "}
                <d.FormattedDate value={expiration} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />.
              </p>
            </d.Alert>
          )}

          {error && <d.Alert variant="warning">{error}</d.Alert>}
        </form>
      </d.Form>
    </d.Popup>
  );
};
