"use client";
import { useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { FormattedDate } from "react-intl";
import { Alert, Button, Form, FormField, FormInput, FormLabel, FormMessage, Popup } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { addYears, format } from "date-fns";
import { z } from "zod";

import { LinkTo } from "@src/components/shared/LinkTo";
import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useSupportedDenoms, useUsdcDenom } from "@src/hooks/useDenom";
import { useDenomData } from "@src/hooks/useWalletBalance";
import type { GrantType } from "@src/types/grant";
import { denomToUdenom } from "@src/utils/mathHelpers";
import { coinToDenom } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { handleDocClick } from "@src/utils/urlUtils";
import { SpendLimitRow } from "./SpendLimitRow";

export const DEPENDENCIES = {
  Alert,
  Button,
  Form,
  FormField,
  FormInput,
  FormLabel,
  FormMessage,
  FormattedDate,
  Popup,
  LinkTo,
  SpendLimitRow,
  useServices,
  useWallet,
  useUsdcDenom,
  useDenomData,
  useSupportedDenoms
};

type Props = {
  address: string;
  editingGrant?: GrantType | null;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

const spendLimitSchema = z.object({
  denom: z.string().min(1, "Token is required."),
  amount: z.coerce.number().gt(0, "Amount must be greater than 0.")
});

const formSchema = z.object({
  spendLimits: z.array(spendLimitSchema).min(1),
  expiration: z.string().min(1, "Expiration is required."),
  granteeAddress: z.string().min(1, "Grantee address is required.")
});

export type GrantFormValues = z.infer<typeof formSchema>;

export const GrantModal: React.FunctionComponent<Props> = ({ editingGrant, address, onClose, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = d.useServices();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const { signAndBroadcastTx } = d.useWallet();
  const usdcDenom = d.useUsdcDenom();
  const supportedTokens = d.useSupportedDenoms();

  const defaultSpendLimits = editingGrant
    ? editingGrant.authorization.spend_limits.map(sl => ({
        denom: sl.denom,
        amount: coinToDenom(sl)
      }))
    : [{ denom: UACT_DENOM, amount: 0 }];

  const form = useForm<GrantFormValues>({
    defaultValues: {
      spendLimits: defaultSpendLimits,
      expiration: format(addYears(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
      granteeAddress: editingGrant?.grantee ?? ""
    },
    resolver: zodResolver(formSchema)
  });
  const { handleSubmit, control, watch, clearErrors } = form;
  const { fields: spendLimitFields, append: appendSpendLimit, remove: removeSpendLimitAt } = useFieldArray({ control, name: "spendLimits" });
  const watchedSpendLimits = watch("spendLimits");
  const granteeAddress = watch("granteeAddress");
  const expiration = watch("expiration");
  const hasAmount = watchedSpendLimits.some(sl => sl.amount > 0);
  const hasActGrant = spendLimitFields.some(f => f.denom === UACT_DENOM);
  const hasAktGrant = spendLimitFields.some(f => f.denom === UAKT_DENOM);
  const canAddGrant = spendLimitFields.length < 2 && !(hasActGrant && hasAktGrant);

  const onDepositClick = (event: React.MouseEvent) => {
    event.preventDefault();
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  const authorizeSpending = async ({ spendLimits, expiration, granteeAddress }: GrantFormValues) => {
    setError("");
    clearErrors();

    const coins = spendLimits.map(sl => ({
      amount: denomToUdenom(sl.amount).toString(),
      denom: sl.denom === "usdc" ? usdcDenom : sl.denom
    }));
    const spendLimit = coins;

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

  const addMissingGrant = () => {
    appendSpendLimit({ denom: hasActGrant ? UAKT_DENOM : UACT_DENOM, amount: 0 });
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
          disabled: !hasAmount,
          onClick: onDepositClick
        }
      ]}
      onClose={onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick
      title="Authorize Spending"
    >
      <d.Form {...form}>
        <form onSubmit={handleSubmit(authorizeSpending)} ref={formRef}>
          <d.Alert className="mb-4">
            <p className="text-sm text-muted-foreground">
              <d.LinkTo onClick={ev => handleDocClick(ev, "https://akash.network/docs/network-features/authorized-spend/")}>Authorized Spend</d.LinkTo> allows
              users to authorize spending of a set number of tokens from a source wallet to a destination, funded wallet. The authorized spend is restricted to
              Akash deployment activities and the recipient of the tokens would not have access to those tokens for other operations.
            </p>
          </d.Alert>

          {spendLimitFields.map((field, index) => (
            <d.SpendLimitRow
              key={field.id}
              index={index}
              denom={watchedSpendLimits[index]?.denom ?? field.denom}
              isRemovable={spendLimitFields.length > 1}
              onRemove={() => removeSpendLimitAt(index)}
            />
          ))}

          {canAddGrant && (
            <div className="mb-4">
              <d.Button variant="outline" size="sm" type="button" className="w-full" onClick={addMissingGrant}>
                {hasActGrant ? "Add AKT Grant" : "Add ACT Grant"}
              </d.Button>
            </div>
          )}

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

          {hasAmount && granteeAddress && (
            <d.Alert>
              <p className="text-sm text-muted-foreground">
                This address will be able to spend up to{" "}
                {watchedSpendLimits
                  .filter(sl => sl.amount > 0)
                  .map(sl => {
                    const token = supportedTokens.find(t => t.id === sl.denom);
                    return `${sl.amount} ${token?.tokenLabel ?? sl.denom}`;
                  })
                  .join(" and ")}{" "}
                on your behalf ending on <d.FormattedDate value={expiration} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />.
              </p>
            </d.Alert>
          )}

          {error && <d.Alert variant="warning">{error}</d.Alert>}
        </form>
      </d.Form>
    </d.Popup>
  );
};
