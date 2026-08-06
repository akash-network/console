"use client";
import type { MouseEventHandler, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { ActionButton } from "@akashnetwork/ui/components";
import { Alert, Form, FormField, FormInput, Popup, RadioGroup, RadioGroupItem } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import { useServices } from "@src/context/ServicesProvider";
import { useAddFundsVerifiedLoginRequiredEventHandler } from "@src/hooks/useAddFundsVerifiedLoginRequiredEventHandler";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import { useDenomData, useWalletBalance } from "@src/hooks/useWalletBalance";
import type { ServiceType } from "@src/types";
import { denomToUdenom, roundDecimal } from "@src/utils/mathHelpers";
import { LeaseSpecDetail } from "../../shared/LeaseSpecDetail";
import { LinkTo } from "../../shared/LinkTo";

export const DEPENDENCIES = {
  useServices,
  useWalletBalance,
  usePricing,
  useDenomData,
  useAddFundsVerifiedLoginRequiredEventHandler,
  useRouter
};

export type DeploymentDepositModalProps = {
  subtitle?: string | ReactNode;
  disableMin?: boolean;
  denom: string;
  onSubmit: (deposit: number) => void;
  onCancel: () => void;
  children?: ReactNode;
  title?: string;
  services?: ServiceType[];
  dependencies?: typeof DEPENDENCIES;
};

const DEPOSIT_PRESETS = [25, 50, 100] as const;

const formSchema = z.object({
  amount: z.coerce
    .number({
      invalid_type_error: "Amount must be a number."
    })
    .min(0, { message: "Amount is required." })
});

export const DeploymentDepositModal: React.FunctionComponent<DeploymentDepositModalProps> = ({
  onCancel,
  onSubmit,
  disableMin,
  denom,
  title = "Deployment Deposit",
  subtitle = null,
  services = [],
  dependencies: d = DEPENDENCIES
}) => {
  const { analyticsService, urlService } = d.useServices();
  const { balance: walletBalance } = d.useWalletBalance();
  const pricing = d.usePricing();
  const depositData = d.useDenomData(denom);
  const whenLoggedInAndVerified = d.useAddFundsVerifiedLoginRequiredEventHandler();
  const router = d.useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: { amount: 0 },
    resolver: zodResolver(formSchema)
  });
  const { handleSubmit, control, watch, setValue, clearErrors } = form;
  const { amount } = watch();

  const isACT = denom === UACT_DENOM;
  const isBelowMin = !disableMin && depositData !== null && amount > 0 && amount < (depositData?.min ?? 0);
  const isACTBalanceInsufficient = depositData !== null && amount > (depositData?.balance ?? 0);
  const isSubmitDisabled = !amount || !walletBalance || isBelowMin || (isACT && isACTBalanceInsufficient);

  useEffect(
    function setMinAmount() {
      if (depositData && amount === 0 && !disableMin) {
        setValue("amount", depositData?.min || 0);
      }
    },
    [depositData, amount, disableMin, setValue]
  );

  const selectPreset = useCallback(
    (value: string) => {
      setSelectedPreset(value);
      setValue("amount", Number(value));
      clearErrors();
    },
    [setValue, clearErrors]
  );

  const clearPresetAndUpdateAmount = useCallback((e: React.ChangeEvent<HTMLInputElement>, fieldOnChange: (e: React.ChangeEvent<HTMLInputElement>) => void) => {
    fieldOnChange(e);
    setSelectedPreset("");
  }, []);

  const fillMaxAmount = useCallback(() => {
    clearErrors();
    setValue("amount", depositData?.max || 0);
  }, [clearErrors, setValue, depositData?.max]);

  const convertAndSubmitDeposit = useCallback(
    ({ amount: submittedAmount }: z.infer<typeof formSchema>) => {
      if (isSubmitDisabled) return;

      const amountInDenom = roundDecimal((denom === UAKT_DENOM ? pricing.usdToAkt(submittedAmount) : submittedAmount) || 0, 6);
      onSubmit(denomToUdenom(amountInDenom));
    },
    [isSubmitDisabled, denom, pricing, onSubmit]
  );

  const submitForm: MouseEventHandler = useCallback(
    event => {
      event.preventDefault();
      formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    },
    [formRef]
  );

  const trackAndClose = useCallback(() => {
    analyticsService.track("close_deposit_modal", "Amplitude");
    onCancel();
  }, [analyticsService, onCancel]);

  const navigateToCheckout = useCallback(() => {
    router.push(urlService.billing({ openPayment: true }));
  }, [router, urlService]);

  const trackAndNavigateToCheckout = useCallback(
    (event: React.MouseEvent) => {
      analyticsService.track("buy_credits_btn_clk", "Amplitude");
      onCancel();
      whenLoggedInAndVerified(navigateToCheckout)(event);
    },
    [analyticsService, onCancel, whenLoggedInAndVerified, navigateToCheckout]
  );

  const actions = useMemo(
    () =>
      [
        {
          label: "Buy credits",
          color: "primary",
          variant: "ghost",
          side: "left",
          onClick: trackAndNavigateToCheckout,
          "data-testid": "deposit-modal-buy-credits-button"
        },
        {
          label: "Cancel",
          color: "primary",
          variant: "outline",
          side: "right",
          onClick: trackAndClose
        },
        {
          label: "Continue",
          color: "secondary",
          variant: "default",
          side: "right",
          disabled: isSubmitDisabled,
          onClick: submitForm,
          "data-testid": "deposit-modal-continue-button"
        }
      ] as ActionButton[],
    [trackAndNavigateToCheckout, trackAndClose, isSubmitDisabled, submitForm]
  );

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      actions={actions}
      onClose={trackAndClose}
      enableCloseOnBackdropClick
      title={
        (title || subtitle) && (
          <div className="flex flex-col gap-1.5">
            {title && <span>{title}</span>}
            {subtitle && <div className="text-sm font-normal text-muted-foreground">{subtitle}</div>}
          </div>
        )
      }
    >
      <div className="space-y-4">
        {services.length > 0 && (
          <div className="max-h-[300px] space-y-4 overflow-auto">
            {services.map(service => (
              <Alert key={service.title}>
                <div className="mb-2 break-all text-sm">
                  <span className="font-bold">{service.title}</span>:{service.image}
                </div>
                <div className="flex items-center space-x-4 whitespace-nowrap">
                  <LeaseSpecDetail type="cpu" className="flex-shrink-0" value={service.profile?.cpu} />
                  {!!service.profile?.gpu && <LeaseSpecDetail type="gpu" className="flex-shrink-0" value={service.profile?.gpu} />}
                  <LeaseSpecDetail type="ram" className="flex-shrink-0" value={`${service.profile?.ram} ${service.profile?.ramUnit}`} />
                  <LeaseSpecDetail
                    type="storage"
                    className="flex-shrink-0"
                    value={`${service.profile?.storage?.[0]?.size ?? "-"} ${service.profile?.storage?.[0]?.unit ?? ""}`}
                  />
                </div>
              </Alert>
            ))}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={handleSubmit(convertAndSubmitDeposit)} ref={formRef}>
            {isACT ? (
              <div className="w-full space-y-4">
                <div>
                  <div className="mb-2 text-sm font-medium">Select the credits amount</div>
                  <RadioGroup value={selectedPreset} onValueChange={selectPreset} className="flex gap-3">
                    {DEPOSIT_PRESETS.map(preset => (
                      <label
                        key={preset}
                        className={cn(
                          "flex flex-1 cursor-pointer items-center gap-3 rounded-lg border p-3",
                          selectedPreset === String(preset) ? "border-primary bg-muted" : "border-border"
                        )}
                      >
                        <RadioGroupItem value={String(preset)} />
                        <span className="text-sm font-medium">${preset}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                <FormField
                  control={control}
                  name="amount"
                  render={({ field }) => (
                    <FormInput
                      {...field}
                      type="number"
                      label={
                        <span>
                          Or enter custom amount <span className="text-muted-foreground">(minimum ${depositData?.min ?? 0})</span>
                        </span>
                      }
                      placeholder="Enter here"
                      min={0}
                      step={0.000001}
                      onChange={e => clearPresetAndUpdateAmount(e, field.onChange)}
                    />
                  )}
                />

                <div
                  className={cn("text-sm", isACTBalanceInsufficient || isBelowMin ? "text-destructive" : "text-muted-foreground")}
                  data-testid="act-balance-display"
                >
                  {isBelowMin ? `Minimum deposit amount is $${depositData?.min}` : `Current Balance: $${depositData?.balance?.toFixed(2)}`}
                </div>
              </div>
            ) : (
              <div className="w-full">
                <FormField
                  control={control}
                  name="amount"
                  render={({ field }) => (
                    <FormInput
                      {...field}
                      type="number"
                      label={
                        <div className="mb-1 flex items-center justify-between">
                          <span>Amount</span>
                          <LinkTo onClick={fillMaxAmount} className="text-xs">
                            Balance: {depositData?.balance} {depositData?.label}
                          </LinkTo>
                        </div>
                      }
                      autoFocus
                      min={!disableMin ? depositData?.min : 0}
                      step={0.000001}
                      max={depositData?.max}
                      startIcon={<div className="pl-2 text-xs">{depositData?.label}</div>}
                    />
                  )}
                />
              </div>
            )}
          </form>
        </Form>
      </div>
    </Popup>
  );
};
