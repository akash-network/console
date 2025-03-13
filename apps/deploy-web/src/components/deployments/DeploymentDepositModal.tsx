"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActionButton,
  Alert,
  CheckboxWithLabel,
  Form,
  FormField,
  FormInput,
  FormItem,
  FormLabel,
  FormMessage,
  Popup,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Snackbar
} from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import compareAsc from "date-fns/compareAsc";
import { useSnackbar } from "notistack";
import { z } from "zod";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { UAKT_DENOM } from "@src/config/denom.config";
import { usePricing } from "@src/context/PricingProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useAddFundsVerifiedLoginRequiredEventHandler } from "@src/hooks/useAddFundsVerifiedLoginRequiredEventHandler";
import { useDenomData, useWalletBalance } from "@src/hooks/useWalletBalance";
import { useGranteeGrants } from "@src/queries/useGrantsQuery";
import { analyticsService } from "@src/services/analytics/analytics.service";
import { ServiceType } from "@src/types";
import { denomToUdenom, udenomToDenom } from "@src/utils/mathHelpers";
import { coinToUDenom } from "@src/utils/priceUtils";
import { LeaseSpecDetail } from "../shared/LeaseSpecDetail";
import { LinkTo } from "../shared/LinkTo";
import { GranteeDepositMenuItem } from "./GranteeDepositMenuItem";

export type DeploymentDepositModalProps = {
  infoText?: string | ReactNode;
  disableMin?: boolean;
  denom: string;
  onDeploymentDeposit: (deposit: number, depositorAddress: string) => void;
  handleCancel: () => void;
  children?: ReactNode;
  title?: string;
  services?: ServiceType[];
};

const formSchema = z
  .object({
    amount: z.coerce
      .number({
        invalid_type_error: "Amount must be a number."
      })
      .min(0.000001, { message: "Amount is required." }),
    useDepositor: z.boolean().optional(),
    depositorAddress: z.string().optional()
  })
  .refine(
    data => {
      if (data.useDepositor && !data.depositorAddress) {
        return false;
      }

      return true;
    },
    { message: "Depositor address is required.", path: ["depositorAddress"] }
  );

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
  const { settings } = useSettings();
  const { enqueueSnackbar } = useSnackbar();
  const [error, setError] = useState("");
  const [isCheckingDepositor, setIsCheckingDepositor] = useState(false);
  const { address, isManaged, isCustodial } = useWallet();
  const { balance: walletBalance } = useWalletBalance();
  const { data: granteeGrants } = useGranteeGrants(address, { enabled: !isManaged });
  const pricing = usePricing();
  const depositData = useDenomData(denom);
  const form = useForm<z.infer<typeof formSchema>>({
    defaultValues: {
      amount: 0,
      useDepositor: false,
      depositorAddress: ""
    },
    resolver: zodResolver(formSchema)
  });
  const { handleSubmit, control, watch, setValue, clearErrors, unregister } = form;
  const { amount, useDepositor, depositorAddress } = watch();
  const validGrants = granteeGrants?.filter(x => compareAsc(new Date(), new Date(x.expiration)) !== 1 && x.authorization.spend_limit.denom === denom) || [];
  const whenLoggedInAndVerified = useAddFundsVerifiedLoginRequiredEventHandler();

  const closePopupAndGoToCheckoutIfPossible = (event: React.MouseEvent) => {
    analyticsService.track("buy_credits_btn_clk", "Amplitude");
    handleCancel();

    whenLoggedInAndVerified(goToCheckout)(event);
  };

  const goToCheckout = () => {
    window.location.href = "/api/proxy/v1/checkout";
  };

  useEffect(() => {
    if (depositData && amount === 0 && !disableMin) {
      setValue("amount", depositData?.min || 0);
    }
  }, [depositData]);

  useEffect(() => {
    clearErrors();
    setError("");

    if (!useDepositor) {
      setValue("depositorAddress", "");
      unregister("depositorAddress");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useDepositor]);

  async function checkDepositor(depositAmount) {
    setIsCheckingDepositor(true);

    try {
      const response = await fetch(`${settings.apiEndpoint}/cosmos/authz/v1beta1/grants?granter=${depositorAddress}&grantee=${address}`);
      const data = await response.json();

      const grant = data.grants?.find(
        x =>
          x.authorization["@type"] === "/akash.deployment.v1beta2.DepositDeploymentAuthorization" ||
          x.authorization["@type"] === "/akash.deployment.v1beta3.DepositDeploymentAuthorization"
      );

      if (!grant) {
        setError("You are not authorized by this depositor.");
        return false;
      }

      const expirationDate = new Date(grant.expiration);
      const expired = compareAsc(new Date(), expirationDate) === 1;

      if (expired) {
        setError(`Authorization expired since ${expirationDate.toDateString()}`);
        return false;
      }

      const spendLimitUDenom = coinToUDenom(grant.authorization.spend_limit);

      if (depositAmount > spendLimitUDenom) {
        setError(`Spend limit remaining: ${udenomToDenom(spendLimitUDenom)} ${depositData?.label}`);
        return false;
      }

      return true;
    } catch (err) {
      console.error(err);
      enqueueSnackbar(<Snackbar title={err.message} iconVariant="error" />, { variant: "error" });
      return false;
    } finally {
      setIsCheckingDepositor(false);
    }
  }

  const onClose = () => {
    analyticsService.track("close_deposit_modal", "Amplitude");
    handleCancel();
  };

  const onBalanceClick = () => {
    clearErrors();
    setValue("amount", depositData?.max || 0);
  };

  const onDepositClick = event => {
    event.preventDefault();
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  const onSubmit = async ({ amount, depositorAddress }: z.infer<typeof formSchema>) => {
    setError("");
    clearErrors();
    const amountInDenom = (isManaged && denom === UAKT_DENOM ? pricing.usdToAkt(amount) : amount) || 0;
    const deposit = denomToUdenom(amountInDenom);

    if (!disableMin && amount < (depositData?.min || 0)) {
      setError(`Deposit amount must be greater or equal than ${depositData?.min}.`);
      return;
    }

    if (useDepositor) {
      const validDepositor = await checkDepositor(deposit);
      if (!validDepositor) {
        return;
      }

      analyticsService.track("use_depositor", {
        category: "deployments",
        label: "Use depositor to deposit in deployment"
      });
    } else if (depositData && amount > depositData?.balance) {
      setError(`You can't deposit more than you currently have in your balance. Current balance is: ${depositData?.balance} ${depositData?.label}.`);
      return;
    }

    onDeploymentDeposit(deposit, isManaged ? browserEnvConfig.NEXT_PUBLIC_MASTER_WALLET_ADDRESS : (depositorAddress as string));
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
            disabled: !amount || isCheckingDepositor || (useDepositor && validGrants.length === 0) || !walletBalance,
            isLoading: isCheckingDepositor,
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
                  <LeaseSpecDetail type="storage" className="flex-shrink-0" value={`${service.profile?.storage} ${service.profile?.storageUnit}`} />
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

          {isCustodial && (
            <div className="my-4 flex items-center">
              <Controller
                control={control}
                name="useDepositor"
                render={({ field }) => {
                  return <CheckboxWithLabel label="Use another address to fund" checked={field.value} onCheckedChange={field.onChange} />;
                }}
              />
            </div>
          )}

          {useDepositor && (
            <FormField
              control={control}
              name="depositorAddress"
              render={({ field }) => {
                return (
                  <FormItem className="mt-2 w-full">
                    <FormLabel htmlFor="deposit-grantee-address">Address</FormLabel>
                    <Select value={field.value || ""} onValueChange={field.onChange} disabled={validGrants.length === 0}>
                      <SelectTrigger id="deposit-grantee-address">
                        <SelectValue placeholder={validGrants.length === 0 ? "No available grants" : "Select address"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {validGrants.map(grant => (
                            <SelectItem key={grant.granter} value={grant.granter}>
                              <GranteeDepositMenuItem grant={grant} />
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>

                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          )}

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
