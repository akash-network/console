"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { Form, FormField, FormInput, LoadingButton, Popup, RadioGroup, RadioGroupItem, Skeleton, Snackbar } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSnackbar } from "notistack";
import { z } from "zod";

import { CardBrandMark } from "@src/components/billing-usage/CardBrandMark/CardBrandMark";
import { UsdValue } from "@src/components/billing-usage/UsdValue/UsdValue";
import { getPaymentMethodDisplay } from "@src/components/shared/PaymentMethodCard/PaymentMethodCard";
import { type AutoReloadMode, useDefaultPaymentMethodQuery, useWalletSettingsMutations, useWeeklyDeploymentCostQuery } from "@src/queries";

export const DEFAULT_AUTO_RELOAD_MODE: AutoReloadMode = "threshold";
export const DEFAULT_AUTO_RELOAD_THRESHOLD = 20;
export const DEFAULT_AUTO_RELOAD_AMOUNT = 100;

/** Mirrors the API's AUTO_RELOAD_THRESHOLD_MIN_USD, itself matching RunPod's auto-pay threshold floor. */
const AUTO_RELOAD_THRESHOLD_MIN_USD = 10;

/** Mirrors the max bound on both fields in the backend's WalletSettingsInputSchema so over-limit values fail inline instead of as a generic 400. */
const AUTO_RELOAD_MAX_USD = 10_000;

/** Mirrors the API's AUTO_RELOAD_AMOUNT_MIN_USD — the floor applied to every recurring auto-top-up charge, independent of the trial-aware one-time top-up minimum. */
export const AUTO_RELOAD_AMOUNT_MIN_USD = 25;

/**
 * Mirrors the API's AUTO_RELOAD_CHARGE_COOLDOWN_IN_MIN, which defaults to 60. Both auto top-up modes take an hourly
 * per-wallet charge claim, so a fast-draining balance defers the next top-up rather than charging the card again
 * right away; only manual top-ups are exempt.
 */
const CHARGE_COOLDOWN_NOTICE =
  "Your card is charged at most once per hour. If your balance runs low again within that hour, the next recharge waits until the hour is up.";

const MODE_OPTIONS: Array<{ value: AutoReloadMode; id: string; title: string; description: string; recommended?: boolean }> = [
  {
    value: "threshold",
    id: "auto-reload-mode-threshold",
    title: "Fixed threshold",
    description: "Charge a set amount as soon as your available balance runs low.",
    recommended: true
  },
  {
    value: "prediction",
    id: "auto-reload-mode-prediction",
    title: "Predicted spend",
    description: "Charge whatever it takes to cover the next week of your current deployments."
  }
];

/**
 * The threshold and amount bounds only apply in threshold mode: prediction mode derives its amounts from projected
 * spend, and its inputs aren't rendered, so a stored value outside the bounds must not block the save.
 */
const autoRechargeSchema = z
  .object({
    autoReloadMode: z.enum(["threshold", "prediction"]),
    autoReloadThreshold: z.coerce.number(),
    autoReloadAmount: z.coerce.number()
  })
  .superRefine((values, ctx) => {
    if (values.autoReloadMode !== "threshold") return;

    const boundedFields = [
      { name: "autoReloadThreshold" as const, value: values.autoReloadThreshold, min: AUTO_RELOAD_THRESHOLD_MIN_USD, label: "threshold" },
      { name: "autoReloadAmount" as const, value: values.autoReloadAmount, min: AUTO_RELOAD_AMOUNT_MIN_USD, label: "amount" }
    ];

    for (const { name, value, min, label } of boundedFields) {
      if (value < min) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: `Minimum ${label} is $${min}` });
      }
      if (value > AUTO_RELOAD_MAX_USD) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [name], message: `Maximum ${label} is $${AUTO_RELOAD_MAX_USD}` });
      }
    }
  });

type AutoRechargeFormValues = z.infer<typeof autoRechargeSchema>;

export const DEPENDENCIES = {
  useForm,
  useSnackbar,
  useDefaultPaymentMethodQuery,
  useWalletSettingsMutations,
  useWeeklyDeploymentCostQuery,
  CardBrandMark,
  UsdValue,
  Skeleton
};

interface AutoRechargeSettingsPopupProps {
  open: boolean;
  onClose: () => void;
  /** True for the first-enable flow (Save turns auto recharge on); false when editing an already-enabled account. */
  enableOnSave: boolean;
  mode?: AutoReloadMode;
  threshold?: number;
  amount?: number;
  dependencies?: typeof DEPENDENCIES;
}

export const AutoRechargeSettingsPopup: React.FC<AutoRechargeSettingsPopupProps> = ({
  open,
  onClose,
  enableOnSave,
  mode,
  threshold,
  amount,
  dependencies: d = DEPENDENCIES
}) => {
  const { enqueueSnackbar } = d.useSnackbar();
  const { data: defaultPaymentMethod } = d.useDefaultPaymentMethodQuery();
  const { upsertWalletSettings } = d.useWalletSettingsMutations();

  const defaultValues = useMemo<AutoRechargeFormValues>(
    () => ({
      autoReloadMode: mode ?? DEFAULT_AUTO_RELOAD_MODE,
      autoReloadThreshold: Math.max(threshold ?? DEFAULT_AUTO_RELOAD_THRESHOLD, AUTO_RELOAD_THRESHOLD_MIN_USD),
      autoReloadAmount: Math.max(amount ?? DEFAULT_AUTO_RELOAD_AMOUNT, AUTO_RELOAD_AMOUNT_MIN_USD)
    }),
    [mode, threshold, amount]
  );

  const form = d.useForm<AutoRechargeFormValues>({
    resolver: zodResolver(autoRechargeSchema),
    defaultValues
  });

  const wasOpen = useRef(open);
  useEffect(
    function resetOnOpen() {
      if (open && !wasOpen.current) {
        form.reset(defaultValues);
      }
      wasOpen.current = open;
    },
    [open, defaultValues, form]
  );

  const selectedMode = form.watch("autoReloadMode");
  const { data: weeklyCost } = d.useWeeklyDeploymentCostQuery({ enabled: open && selectedMode === "prediction" });
  const cardDisplay = defaultPaymentMethod ? getPaymentMethodDisplay(defaultPaymentMethod as PaymentMethod) : null;

  const saveSettings = form.handleSubmit(values => {
    upsertWalletSettings.mutate(
      {
        data: {
          autoReloadEnabled: true,
          autoReloadMode: values.autoReloadMode,
          ...(values.autoReloadMode === "threshold" && {
            autoReloadThreshold: values.autoReloadThreshold,
            autoReloadAmount: values.autoReloadAmount
          })
        }
      },
      {
        onSuccess: () => {
          enqueueSnackbar(<Snackbar title={enableOnSave ? "Auto recharge enabled" : "Auto recharge settings updated"} iconVariant="success" />, {
            variant: "success",
            autoHideDuration: 3000
          });
          onClose();
        },
        onError: () => enqueueSnackbar(<Snackbar title="Failed to save auto recharge settings" iconVariant="error" />, { variant: "error" })
      }
    );
  });

  return (
    <Popup open={open} onClose={onClose} title="Auto recharge settings" variant="custom" actions={[]} maxWidth="sm">
      <Form {...form}>
        <form className="space-y-[18px]" onSubmit={saveSettings}>
          <p className="text-[13px] text-muted-foreground">This will use your default payment method on file.</p>

          {cardDisplay && (
            <div className="flex items-center gap-3 rounded-[10px] border px-3.5 py-3">
              <d.CardBrandMark brand={defaultPaymentMethod?.card?.brand ?? defaultPaymentMethod?.type} />
              <span className="min-w-0 truncate text-[13.5px] font-medium">{cardDisplay.label}</span>
              {cardDisplay.expiry && <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">{cardDisplay.expiry}</span>}
            </div>
          )}

          <FormField
            control={form.control}
            name="autoReloadMode"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} aria-label="Auto recharge mode" className="gap-2">
                {MODE_OPTIONS.map(option => (
                  <label
                    key={option.value}
                    htmlFor={option.id}
                    className="flex cursor-pointer items-start gap-3 rounded-[10px] border px-4 py-3.5 transition-colors has-[[data-state=checked]]:border-foreground"
                  >
                    <RadioGroupItem value={option.value} id={option.id} className="mt-0.5" />
                    <span className="flex min-w-0 flex-col gap-[3px]">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {option.title}
                        {enableOnSave && option.recommended && (
                          <span className="rounded-full bg-foreground px-[7px] py-px text-[11px] font-semibold text-background">Recommended</span>
                        )}
                      </span>
                      <span className="text-[13px] text-muted-foreground">{option.description}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
          />

          {selectedMode === "threshold" ? (
            <>
              <FormField
                control={form.control}
                name="autoReloadThreshold"
                render={({ field }) => (
                  <FormInput
                    {...field}
                    type="number"
                    step="0.01"
                    label={`When credit balance drops to or below (minimum $${AUTO_RELOAD_THRESHOLD_MIN_USD})`}
                    description="If your current balance is at or below the threshold you set, the first recharge happens shortly after you save."
                    startIcon={<div className="pl-3 text-sm text-muted-foreground">$</div>}
                  />
                )}
              />

              <FormField
                control={form.control}
                name="autoReloadAmount"
                render={({ field }) => (
                  <FormInput
                    {...field}
                    type="number"
                    step="0.01"
                    label={`Purchase this amount (minimum $${AUTO_RELOAD_AMOUNT_MIN_USD})`}
                    startIcon={<div className="pl-3 text-sm text-muted-foreground">$</div>}
                  />
                )}
              />
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">Estimated recharge</p>
              <div className="flex items-baseline justify-between gap-3 rounded-[10px] bg-muted px-3.5 py-3">
                <span className="text-[13px] text-muted-foreground">One week at current spend</span>
                {weeklyCost === undefined ? (
                  <d.Skeleton className="h-5 w-16" />
                ) : (
                  <span className="text-base font-semibold tabular-nums" aria-label="Estimated weekly recharge">
                    <d.UsdValue value={weeklyCost} />
                  </span>
                )}
              </div>
              <p className="text-[13px] text-muted-foreground">We check your deployments once a day and charge enough to keep them running for another week.</p>
            </div>
          )}

          <p className="text-[13px] text-muted-foreground">{CHARGE_COOLDOWN_NOTICE}</p>

          <LoadingButton type="submit" className="w-full" loading={upsertWalletSettings.isPending}>
            Save changes
          </LoadingButton>
        </form>
      </Form>
    </Popup>
  );
};
