"use client";

import type { FC } from "react";
import React, { useCallback, useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import {
  Alert,
  Button,
  CheckboxWithLabel,
  Form,
  FormField,
  FormInput,
  FormLabel,
  LoadingButton,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { isEqual } from "lodash";
import { z } from "zod";

import { NotificationChannelSelect } from "@src/components/alerts/NotificationChannelSelectForm/NotificationChannelSelect";
import type { ChangeableComponentProps } from "@src/types/changeable-component-props.type";
import { getDenomLabel } from "@src/utils/denomLabel";

export const DEPENDENCIES = { NotificationChannelSelect };

const BALANCE_OPERATORS = ["lt", "lte", "gt", "gte", "eq"] as const;
type BalanceOperator = (typeof BALANCE_OPERATORS)[number];

const OPERATOR_LABELS: Record<BalanceOperator, string> = {
  lt: "below",
  lte: "below or equal to",
  gt: "above",
  gte: "above or equal to",
  eq: "equal to"
};

const formSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  notificationChannelId: z.string().min(1, "Notification channel is required"),
  operator: z.enum(BALANCE_OPERATORS),
  amount: z.number({ invalid_type_error: "Threshold is required" }).min(0, "Threshold must be greater than or equal to 0"),
  enabled: z.boolean()
});
type FormValues = z.infer<typeof formSchema>;

export type WalletBalanceAlertFormValues = Pick<FormValues, "name" | "notificationChannelId" | "enabled"> & {
  conditions: { operator: BalanceOperator; field: "balance"; value: number };
};

export type WalletBalanceAlertFormProps = ChangeableComponentProps<{
  initialValues: FormValues;
  owner: string;
  denom: string;
  onSubmit: (data: WalletBalanceAlertFormValues) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  dependencies?: typeof DEPENDENCIES;
}>;

export const WalletBalanceAlertForm: FC<WalletBalanceAlertFormProps> = ({
  initialValues,
  owner,
  denom,
  onSubmit,
  onCancel,
  isLoading,
  onStateChange,
  dependencies: d = DEPENDENCIES
}) => {
  const { symbol, decimals } = useMemo(() => getDenomLabel(denom), [denom]);

  const form = useForm<FormValues>({
    defaultValues: initialValues,
    reValidateMode: "onSubmit",
    resolver: zodResolver(formSchema)
  });
  const { control, handleSubmit } = form;

  const submit = useCallback(
    (values: FormValues) => {
      onSubmit({
        name: values.name,
        notificationChannelId: values.notificationChannelId,
        enabled: values.enabled,
        conditions: {
          operator: values.operator,
          field: "balance",
          value: Math.round(values.amount * 10 ** decimals)
        }
      });
    },
    [onSubmit, decimals]
  );

  const currentValues = useWatch({ control });
  const amount = currentValues.amount ?? 0;

  const hasChanges = useMemo(() => {
    const fields = Object.keys(initialValues) as (keyof FormValues)[];
    return fields.some(key => !isEqual(initialValues[key], currentValues[key]));
  }, [currentValues, initialValues]);

  useEffect(() => {
    onStateChange?.({ hasChanges });
  }, [hasChanges, onStateChange]);

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(submit)} className="max-w-xl space-y-6 p-6">
        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormInput
              data-testid="wallet-balance-alert-name"
              label="Name"
              value={field.value}
              onChange={event => field.onChange(event.target.value)}
              disabled={isLoading}
            />
          )}
        />

        <div className="space-y-2">
          <FormLabel>Wallet</FormLabel>
          <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2">
            <span className="break-all font-mono text-sm" data-testid="wallet-balance-alert-owner">
              {owner}
            </span>
            <span className="shrink-0 rounded border bg-background px-2 py-0.5 font-mono text-xs text-muted-foreground">{denom}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            The watched wallet and denom can&apos;t be changed. To watch a different wallet, delete this alert and create a new one.
          </p>
        </div>

        <div className="space-y-2">
          <FormLabel>Alert me when balance is</FormLabel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <FormField
              control={control}
              name="operator"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                  <SelectTrigger className="sm:w-56" data-testid="wallet-balance-alert-operator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {BALANCE_OPERATORS.map(operator => (
                        <SelectItem key={operator} value={operator}>
                          {OPERATOR_LABELS[operator]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            <div className="flex-1">
              <FormField
                control={control}
                name="amount"
                render={({ field }) => (
                  <FormInput
                    type="number"
                    step={1 / 10 ** decimals}
                    min={0}
                    data-testid="wallet-balance-alert-amount"
                    endIcon={<span className="pr-3 font-mono text-sm text-muted-foreground">{symbol}</span>}
                    value={Number.isNaN(field.value) ? "" : field.value}
                    onChange={event => field.onChange(event.target.valueAsNumber)}
                    disabled={isLoading}
                  />
                )}
              />
              <p className="pt-1 font-mono text-xs text-muted-foreground" data-testid="wallet-balance-alert-base-preview">
                stored as {Math.round((Number.isNaN(amount) ? 0 : amount) * 10 ** decimals).toLocaleString("en-US")} {denom}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <d.NotificationChannelSelect name="notificationChannelId" disabled={isLoading} />
        </div>

        <FormField
          control={control}
          name="enabled"
          render={({ field }) => (
            <CheckboxWithLabel
              label="Enabled"
              data-testid="wallet-balance-alert-enabled"
              disabled={isLoading}
              checked={field.value}
              onCheckedChange={value => field.onChange(value as boolean)}
              labelClassName="font-bold"
            />
          )}
        />

        {form.formState.errors.root && <Alert variant="destructive">{form.formState.errors.root.message}</Alert>}

        <div className="flex justify-end gap-4">
          {onCancel && (
            <Button data-testid="wallet-balance-alert-cancel" disabled={isLoading} type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <LoadingButton data-testid="wallet-balance-alert-submit" disabled={isLoading || !hasChanges} loading={isLoading} type="submit">
            Save changes
          </LoadingButton>
        </div>
      </form>
    </Form>
  );
};
