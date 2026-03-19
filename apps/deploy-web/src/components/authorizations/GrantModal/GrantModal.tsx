"use client";
import { useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { FormattedDate } from "react-intl";
import {
  Alert,
  Button,
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
import { Bin } from "iconoir-react";
import { z } from "zod";

import { LinkTo } from "@src/components/shared/LinkTo";
import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useSupportedDenoms, useUsdcDenom } from "@src/hooks/useDenom";
import { useSupportsACT } from "@src/hooks/useSupportsACT/useSupportsACT";
import { useDenomData } from "@src/hooks/useWalletBalance";
import type { GrantType } from "@src/types/grant";
import { denomToUdenom } from "@src/utils/mathHelpers";
import { coinToDenom } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { handleDocClick } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  Alert,
  Button,
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
  Bin,
  useServices,
  useWallet,
  useUsdcDenom,
  useDenomData,
  useSupportsACT,
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

type FormValues = z.infer<typeof formSchema>;

export const GrantModal: React.FunctionComponent<Props> = ({ editingGrant, address, onClose, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = d.useServices();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const { signAndBroadcastTx } = d.useWallet();
  const usdcDenom = d.useUsdcDenom();
  const isACTSupported = d.useSupportsACT();
  const supportedTokens = d.useSupportedDenoms();

  const defaultSpendLimits = editingGrant
    ? editingGrant.authorization.spend_limits.map(sl => ({
        denom: sl.denom,
        amount: coinToDenom(sl)
      }))
    : [{ denom: isACTSupported ? UACT_DENOM : UAKT_DENOM, amount: 0 }];

  const form = useForm<FormValues>({
    defaultValues: {
      spendLimits: defaultSpendLimits,
      expiration: format(addYears(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
      granteeAddress: editingGrant?.grantee ?? ""
    },
    resolver: zodResolver(formSchema)
  });
  const { handleSubmit, control, watch, clearErrors, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "spendLimits" });
  const watchedSpendLimits = watch("spendLimits");
  const granteeAddress = watch("granteeAddress");
  const expiration = watch("expiration");
  const hasAmount = watchedSpendLimits.some(sl => sl.amount > 0);
  const canAddAkt = isACTSupported && fields.length < 2 && !fields.some(f => f.denom === UAKT_DENOM);

  const onDepositClick = (event: React.MouseEvent) => {
    event.preventDefault();
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  const authorizeSpending = async ({ spendLimits, expiration, granteeAddress }: FormValues) => {
    setError("");
    clearErrors();

    const coins = spendLimits.map(sl => ({
      amount: denomToUdenom(sl.amount).toString(),
      denom: sl.denom === "usdc" ? usdcDenom : sl.denom
    }));
    const spendLimit = isACTSupported ? coins : coins[0];

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

  const addAktGrant = () => {
    append({ denom: UAKT_DENOM, amount: 0 });
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

          {fields.map((field, index) => (
            <SpendLimitRow
              key={field.id}
              control={control}
              index={index}
              denom={watchedSpendLimits[index]?.denom ?? field.denom}
              isACTSupported={isACTSupported}
              supportedTokens={supportedTokens}
              isRemovable={isACTSupported && index > 0}
              onRemove={() => remove(index)}
              clearErrors={clearErrors}
              setValue={setValue}
              dependencies={d}
            />
          ))}

          {canAddAkt && (
            <div className="mb-4">
              <d.Button variant="outline" size="sm" type="button" className="w-full" onClick={addAktGrant}>
                Add AKT Grant
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

type SpendLimitRowProps = {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  index: number;
  denom: string;
  isACTSupported: boolean;
  supportedTokens: ReturnType<typeof useSupportedDenoms>;
  isRemovable: boolean;
  onRemove: () => void;
  clearErrors: () => void;
  setValue: ReturnType<typeof useForm<FormValues>>["setValue"];
  dependencies: typeof DEPENDENCIES;
};

const SpendLimitRow: React.FunctionComponent<SpendLimitRowProps> = ({
  control,
  index,
  denom,
  isACTSupported,
  supportedTokens,
  isRemovable,
  onRemove,
  clearErrors,
  setValue,
  dependencies: d
}) => {
  const usdcDenom = d.useUsdcDenom();
  const resolvedDenom = denom === "usdc" ? usdcDenom : denom;
  const denomData = d.useDenomData(resolvedDenom);
  const tokenInfo = supportedTokens.find(t => t.id === denom);

  const onBalanceClick = () => {
    clearErrors();
    setValue(`spendLimits.${index}.amount`, denomData?.max || 0);
  };

  return (
    <div className="mb-4">
      <div className="flex w-full flex-row items-center">
        {!isACTSupported && (
          <d.FormField
            control={control}
            name={`spendLimits.${index}.denom`}
            render={({ field }) => {
              return (
                <div>
                  <d.FormLabel htmlFor={`grant-token-${index}`}>Token</d.FormLabel>
                  <d.Select value={field.value || ""} onValueChange={field.onChange}>
                    <d.SelectTrigger id={`grant-token-${index}`}>
                      <d.SelectValue placeholder="Select grant token" />
                    </d.SelectTrigger>
                    <d.SelectContent>
                      <d.SelectGroup>
                        {supportedTokens.map(token => (
                          <d.SelectItem key={token.id} value={token.id}>
                            {token.tokenLabel}
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
        )}
        <d.FormField
          control={control}
          name={`spendLimits.${index}.amount`}
          render={({ field }) => {
            return (
              <d.FormInput
                {...field}
                type="number"
                label={
                  <div className="mb-2 flex justify-between">
                    <div>Spending Limit ({tokenInfo?.tokenLabel ?? denom})</div>
                    <d.LinkTo onClick={() => onBalanceClick()}>
                      Balance: {denomData?.balance} {denomData?.label}
                    </d.LinkTo>
                  </div>
                }
                autoFocus={index === 0}
                min={0}
                step={0.000001}
                max={denomData?.max}
                startIcon={<span className="pl-2 text-xs">{denomData?.label}</span>}
                endIcon={
                  isRemovable ? (
                    <button type="button" className="pr-2" onClick={onRemove}>
                      <d.Bin className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  ) : undefined
                }
                className={isACTSupported ? "flex-grow" : "ml-4 flex-grow"}
              />
            );
          }}
        />
      </div>
    </div>
  );
};
