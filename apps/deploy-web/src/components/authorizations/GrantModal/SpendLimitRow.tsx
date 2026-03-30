import { useFormContext } from "react-hook-form";
import { FormField, FormInput, FormMessage } from "@akashnetwork/ui/components";
import { Bin } from "iconoir-react";

import { LinkTo } from "@src/components/shared/LinkTo";
import { useSupportedDenoms, useUsdcDenom } from "@src/hooks/useDenom";
import { useDenomData } from "@src/hooks/useWalletBalance";
import type { GrantFormValues } from "./GrantModal";

export const DEPENDENCIES = {
  useSupportedDenoms,
  useUsdcDenom,
  useDenomData,
  useFormContext,
  FormField,
  FormMessage,
  FormInput,
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
  const supportedTokens = d.useSupportedDenoms();
  const usdcDenom = d.useUsdcDenom();
  const resolvedDenom = denom === "usdc" ? usdcDenom : denom;
  const denomData = d.useDenomData(resolvedDenom);
  const tokenInfo = supportedTokens.find(t => t.id === denom);

  return (
    <div className="mb-4">
      <div className="flex w-full flex-row items-center">
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
                className="flex-grow"
              />
            );
          }}
        />
      </div>
    </div>
  );
};
