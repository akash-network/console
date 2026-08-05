"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { Form, FormField, FormInput, LoadingButton, Popup, Snackbar } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard } from "iconoir-react";
import { useSnackbar } from "notistack";
import { z } from "zod";

import { getPaymentMethodDisplay } from "@src/components/shared/PaymentMethodCard/PaymentMethodCard";
import { useDefaultPaymentMethodQuery, useWalletSettingsMutations } from "@src/queries";

export const DEFAULT_AUTO_RELOAD_THRESHOLD = 20;
export const DEFAULT_AUTO_RELOAD_AMOUNT = 100;

/** Matches AkashML's minimum credit-balance threshold. */
const AUTO_RELOAD_THRESHOLD_MIN_USD = 5;

/** Mirrors the max bound on both fields in the backend's WalletSettingsInputSchema so over-limit values fail inline instead of as a generic 400. */
const AUTO_RELOAD_MAX_USD = 10_000;

/** Mirrors STANDARD_TOP_UP_MIN_AMOUNT_USD — the fixed floor the backend applies to every recurring auto-top-up charge, independent of the trial-aware one-time top-up minimum. */
const AUTO_RELOAD_AMOUNT_MIN_USD = 20;

const autoTopUpSchema = z.object({
  autoReloadThreshold: z.coerce
    .number()
    .min(AUTO_RELOAD_THRESHOLD_MIN_USD, `Minimum threshold is $${AUTO_RELOAD_THRESHOLD_MIN_USD}`)
    .max(AUTO_RELOAD_MAX_USD, `Maximum threshold is $${AUTO_RELOAD_MAX_USD}`),
  autoReloadAmount: z.coerce
    .number()
    .min(AUTO_RELOAD_AMOUNT_MIN_USD, `Minimum amount is $${AUTO_RELOAD_AMOUNT_MIN_USD}`)
    .max(AUTO_RELOAD_MAX_USD, `Maximum amount is $${AUTO_RELOAD_MAX_USD}`)
});

type AutoTopUpFormValues = z.infer<typeof autoTopUpSchema>;

export const DEPENDENCIES = {
  useForm,
  zodResolver,
  useSnackbar,
  useDefaultPaymentMethodQuery,
  useWalletSettingsMutations
};

interface AutoTopUpSettingsPopupProps {
  open: boolean;
  onClose: () => void;
  /** True for the first-enable flow (Save turns auto top-up on); false when editing an already-enabled account. */
  enableOnSave: boolean;
  threshold?: number;
  amount?: number;
  dependencies?: typeof DEPENDENCIES;
}

export const AutoTopUpSettingsPopup: React.FC<AutoTopUpSettingsPopupProps> = ({
  open,
  onClose,
  enableOnSave,
  threshold,
  amount,
  dependencies: d = DEPENDENCIES
}) => {
  const { enqueueSnackbar } = d.useSnackbar();
  const { data: defaultPaymentMethod } = d.useDefaultPaymentMethodQuery();
  const { upsertWalletSettings } = d.useWalletSettingsMutations();

  const defaultValues = useMemo<AutoTopUpFormValues>(
    () => ({
      autoReloadThreshold: threshold ?? DEFAULT_AUTO_RELOAD_THRESHOLD,
      autoReloadAmount: amount ?? DEFAULT_AUTO_RELOAD_AMOUNT
    }),
    [threshold, amount]
  );

  const form = d.useForm<AutoTopUpFormValues>({
    resolver: d.zodResolver(autoTopUpSchema),
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

  const cardDisplay = defaultPaymentMethod ? getPaymentMethodDisplay(defaultPaymentMethod as PaymentMethod) : null;

  const saveSettings = form.handleSubmit(values => {
    upsertWalletSettings.mutate(
      {
        data: {
          autoReloadEnabled: true,
          autoReloadThreshold: values.autoReloadThreshold,
          autoReloadAmount: values.autoReloadAmount
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

          <LoadingButton type="submit" className="w-full" loading={upsertWalletSettings.isPending}>
            Save changes
          </LoadingButton>
        </form>
      </Form>
    </Popup>
  );
};
