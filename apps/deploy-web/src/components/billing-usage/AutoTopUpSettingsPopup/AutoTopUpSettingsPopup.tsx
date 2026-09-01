"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import {
  Badge,
  Field,
  FieldContent,
  FieldLabel,
  FieldTitle,
  Form,
  FormField,
  FormInput,
  LoadingButton,
  Popup,
  RadioGroup,
  RadioGroupItem,
  Snackbar
} from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard } from "iconoir-react";
import { useSnackbar } from "notistack";
import { z } from "zod";

import { getPaymentMethodDisplay } from "@src/components/shared/PaymentMethodCard/PaymentMethodCard";
import { type AutoReloadMode, useDefaultPaymentMethodQuery, useWalletSettingsMutations } from "@src/queries";

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
  "Your card is charged at most once per hour. If your balance runs low again within that hour, the next top-up waits until the hour is up.";

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
const autoTopUpSchema = z
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

type AutoTopUpFormValues = z.infer<typeof autoTopUpSchema>;

export const DEPENDENCIES = {
  useForm,
  useSnackbar,
  useDefaultPaymentMethodQuery,
  useWalletSettingsMutations
};

interface AutoTopUpSettingsPopupProps {
  open: boolean;
  onClose: () => void;
  /** True for the first-enable flow (Save turns auto top-up on); false when editing an already-enabled account. */
  enableOnSave: boolean;
  mode?: AutoReloadMode;
  threshold?: number;
  amount?: number;
  dependencies?: typeof DEPENDENCIES;
}

export const AutoTopUpSettingsPopup: React.FC<AutoTopUpSettingsPopupProps> = ({
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

  const defaultValues = useMemo<AutoTopUpFormValues>(
    () => ({
      autoReloadMode: mode ?? DEFAULT_AUTO_RELOAD_MODE,
      autoReloadThreshold: Math.max(threshold ?? DEFAULT_AUTO_RELOAD_THRESHOLD, AUTO_RELOAD_THRESHOLD_MIN_USD),
      autoReloadAmount: Math.max(amount ?? DEFAULT_AUTO_RELOAD_AMOUNT, AUTO_RELOAD_AMOUNT_MIN_USD)
    }),
    [mode, threshold, amount]
  );

  const form = d.useForm<AutoTopUpFormValues>({
    resolver: zodResolver(autoTopUpSchema),
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
          enqueueSnackbar(<Snackbar title={enableOnSave ? "Auto Top-Up enabled" : "Auto Top-Up settings updated"} iconVariant="success" />, {
            variant: "success",
            autoHideDuration: 3000
          });
          onClose();
        },
        onError: () => enqueueSnackbar(<Snackbar title="Failed to save Auto Top-Up settings" iconVariant="error" />, { variant: "error" })
      }
    );
  });

  return (
    <Popup open={open} onClose={onClose} title="Auto Top-Up Settings" variant="custom" actions={[]} maxWidth="sm">
      <Form {...form}>
        <form className="space-y-6" onSubmit={saveSettings}>
          <p className="text-sm text-muted-foreground">This will use your default payment method on file.</p>

          {cardDisplay && (
            <div className="flex items-center gap-3 rounded-md border p-3">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">
                {cardDisplay.label}
                {cardDisplay.expiry ? ` · ${cardDisplay.expiry}` : ""}
              </p>
            </div>
          )}

          <FormField
            control={form.control}
            name="autoReloadMode"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} aria-label="Auto top-up mode">
                {MODE_OPTIONS.map(option => (
                  <FieldLabel key={option.value} htmlFor={option.id}>
                    <Field orientation="horizontal" className="cursor-pointer p-3">
                      <RadioGroupItem value={option.value} id={option.id} className="self-center" />
                      <FieldContent>
                        <FieldTitle className="font-medium">
                          {option.title}
                          {enableOnSave && option.recommended && (
                            <Badge variant="info" className="h-4 px-1.5 py-0">
                              Recommended
                            </Badge>
                          )}
                        </FieldTitle>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
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
                    description="If your current balance is at or below the threshold you set, your top-up will kick in shortly after you save."
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
            <p className="text-sm text-muted-foreground">
              We check your deployments once a day and charge enough to keep them running for another week. There is nothing else to configure.
            </p>
          )}

          <p className="text-sm text-muted-foreground">{CHARGE_COOLDOWN_NOTICE}</p>

          <LoadingButton type="submit" className="w-full" loading={upsertWalletSettings.isPending}>
            Save changes
          </LoadingButton>
        </form>
      </Form>
    </Popup>
  );
};
