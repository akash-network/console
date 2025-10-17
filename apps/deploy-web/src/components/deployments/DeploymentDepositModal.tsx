"use client";
import type { MouseEventHandler, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { ActionButton } from "@akashnetwork/ui/components";
import { Alert, Form, FormField, FormInput, Popup } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { UAKT_DENOM } from "@src/config/denom.config";
import { usePricing } from "@src/context/PricingProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useAddFundsVerifiedLoginRequiredEventHandler } from "@src/hooks/useAddFundsVerifiedLoginRequiredEventHandler";
import { useDenomData, useWalletBalance } from "@src/hooks/useWalletBalance";
import { analyticsService } from "@src/services/analytics/analytics.service";
import type { ServiceType } from "@src/types";
import { denomToUdenom } from "@src/utils/mathHelpers";
import { UrlService } from "@src/utils/urlUtils";
import { LeaseSpecDetail } from "../shared/LeaseSpecDetail";
import { LinkTo } from "../shared/LinkTo";

export type DeploymentDepositModalProps = {
  infoText?: string | ReactNode;
  disableMin?: boolean;
  denom: string;
  onDeploymentDeposit: (deposit: number) => void;
  handleCancel: () => void;
  children?: ReactNode;
  title?: string;
  services?: ServiceType[];
};

const formSchema = z.object({
  amount: z.coerce
    .number({
      invalid_type_error: "Amount must be a number."
    })
    .min(0.000001, { message: "Amount is required." })
});

export const DeploymentDepositModal: React.FunctionComponent<DeploymentDepositModalProps> = ({
  handleCancel,
  onDeploymentDeposit,
  disableMin,
  denom,
  title = "Deployment Deposit",
  infoText = null,
  services = []
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const { isManaged } = useWallet();
  const { balance: walletBalance } = useWalletBalance();
  const pricing = usePricing();
  const depositData = useDenomData(denom);
  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      amount: 0
    },
    resolver: zodResolver(formSchema)
  });
  const { handleSubmit, control, watch, setValue, clearErrors } = form;
  const { amount } = watch();
  const whenLoggedInAndVerified = useAddFundsVerifiedLoginRequiredEventHandler();
  const router = useRouter();

  const closePopupAndGoToCheckoutIfPossible = (event: React.MouseEvent) => {
    analyticsService.track("buy_credits_btn_clk", "Amplitude");
    handleCancel();

    whenLoggedInAndVerified(goToCheckout)(event);
  };

  const goToCheckout = () => {
    router.push(UrlService.payment());
  };

  useEffect(() => {
    if (depositData && amount === 0 && !disableMin) {
      setValue("amount", depositData?.min || 0);
    }
  }, [depositData, amount, disableMin, setValue]);

  const onClose = () => {
    analyticsService.track("close_deposit_modal", "Amplitude");
    handleCancel();
  };

  const onBalanceClick = () => {
    clearErrors();
    setValue("amount", depositData?.max || 0);
  };

  const onDepositClick: MouseEventHandler = event => {
    event.preventDefault();
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  const onSubmit = async ({ amount }: z.infer<typeof formSchema>) => {
    setError("");
    clearErrors();
    const amountInDenom = (isManaged && denom === UAKT_DENOM ? pricing.usdToAkt(amount) : amount) || 0;
    const deposit = denomToUdenom(amountInDenom);

    if (!disableMin && amount < (depositData?.min || 0)) {
      setError(`Deposit amount must be greater or equal than ${depositData?.min}.`);
      return;
    }

    if (depositData && amount > depositData?.balance) {
      setError(`You can't deposit more than you currently have in your balance. Current balance is: ${depositData?.balance} ${depositData?.label}.`);
      return;
    }

    onDeploymentDeposit(deposit);
  };

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      actions={
        [
          {
            label: "Cancel",
            color: "primary",
            variant: "ghost",
            side: "left",
            onClick: onClose
          },
          ...(isManaged
            ? [
                {
                  label: "Buy credits",
                  color: "primary",
                  variant: "ghost",
                  side: "right",
                  onClick: closePopupAndGoToCheckoutIfPossible,
                  "data-testid": "deposit-modal-buy-credits-button"
                }
              ]
            : []),
          {
            label: "Continue",
            color: "secondary",
            variant: "default",
            side: "right",
            disabled: !amount || !walletBalance,
            onClick: onDepositClick,
            "data-testid": "deposit-modal-continue-button"
          }
        ] as ActionButton[]
      }
      onClose={onClose}
      enableCloseOnBackdropClick
      title={title}
    >
      {services.length > 0 && (
        <div className="mb-3 max-h-[300px] overflow-auto">
          {services.map(service => {
            return (
              <Alert key={service.title} className="mb-1">
                <div className="mb-2 break-all text-sm">
                  <span className="font-bold">{service.title}</span>:{service.image}
                </div>
                <div className="flex items-center space-x-4 whitespace-nowrap">
                  <LeaseSpecDetail type="cpu" className="flex-shrink-0" value={service.profile?.cpu} />
                  {!!service.profile?.gpu && <LeaseSpecDetail type="gpu" className="flex-shrink-0" value={service.profile?.gpu} />}
                  <LeaseSpecDetail type="ram" className="flex-shrink-0" value={`${service.profile?.ram} ${service.profile?.ramUnit}`} />
                  <LeaseSpecDetail type="storage" className="flex-shrink-0" value={`${service.profile?.storage[0].size} ${service.profile?.storage[0].unit}`} />
                </div>
              </Alert>
            );
          })}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          {infoText}

          <div className="w-full">
            <FormField
              control={control}
              name="amount"
              render={({ field }) => {
                return (
                  <FormInput
                    {...field}
                    type="number"
                    label={
                      <div className="mb-1 flex items-center justify-between">
                        <span>Amount</span>
                        <LinkTo onClick={() => onBalanceClick()} className="text-xs">
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
                );
              }}
            />
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4 text-sm">
              {error}
            </Alert>
          )}
        </form>
      </Form>
    </Popup>
  );
};
