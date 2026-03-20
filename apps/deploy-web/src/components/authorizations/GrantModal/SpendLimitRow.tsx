import { useFormContext } from "react-hook-form";
import {
  FormField,
  FormInput,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@akashnetwork/ui/components";
import { Bin } from "iconoir-react";

import { LinkTo } from "@src/components/shared/LinkTo";
import { useSupportedDenoms, useUsdcDenom } from "@src/hooks/useDenom";
import { useSupportsACT } from "@src/hooks/useSupportsACT/useSupportsACT";
import { useDenomData } from "@src/hooks/useWalletBalance";
import type { GrantFormValues } from "./GrantModal";

export const DEPENDENCIES = {
  useSupportsACT,
  useSupportedDenoms,
  useUsdcDenom,
  useDenomData,
  useFormContext,
  FormField,
  FormLabel,
  FormMessage,
  FormInput,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  Bin,
  LinkTo
};

type Props = {
  index: number;
  denom: string;
  isRemovable: boolean;
  onRemove: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const SpendLimitRow: React.FunctionComponent<Props> = ({ index, denom, isRemovable, onRemove, dependencies: d = DEPENDENCIES }) => {
  const { control, clearErrors } = d.useFormContext<GrantFormValues>();
  const isACTSupported = d.useSupportsACT();
  const supportedTokens = d.useSupportedDenoms();
  const usdcDenom = d.useUsdcDenom();
  const resolvedDenom = denom === "usdc" ? usdcDenom : denom;
  const denomData = d.useDenomData(resolvedDenom);
  const tokenInfo = supportedTokens.find(t => t.id === denom);

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
            const setMaxAmount = () => {
              clearErrors();
              field.onChange(denomData?.max || 0);
            };
            return (
              <d.FormInput
                {...field}
                type="number"
                label={
                  <div className="mb-2 flex justify-between">
                    <div>Spending Limit ({tokenInfo?.tokenLabel ?? denom})</div>
                    <d.LinkTo onClick={setMaxAmount}>
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
