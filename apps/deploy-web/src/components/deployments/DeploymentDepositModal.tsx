"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
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
import { event } from "nextjs-google-analytics";
import { useSnackbar } from "notistack";
import { z } from "zod";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { UAKT_DENOM } from "@src/config/denom.config";
import { usePricing } from "@src/context/PricingProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useDenomData, useWalletBalance } from "@src/hooks/useWalletBalance";
import { useGranteeGrants } from "@src/queries/useGrantsQuery";
import { AnalyticsEvents } from "@src/utils/analytics";
import { denomToUdenom, udenomToDenom } from "@src/utils/mathHelpers";
import { coinToUDenom } from "@src/utils/priceUtils";
import { LinkTo } from "../shared/LinkTo";
import { GranteeDepositMenuItem } from "./GranteeDepositMenuItem";

export type DeploymentDepositModalProps = {
  infoText?: string | ReactNode;
  disableMin?: boolean;
  denom: string;
  onDeploymentDeposit: (deposit: number, depositorAddress: string) => void;
  handleCancel: () => void;
  children?: ReactNode;
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
  infoText = null
}) => {
  const formRef = useRef<HTMLFormElement>(null);
  const { settings } = useSettings();
  const { enqueueSnackbar } = useSnackbar();
  const [error, setError] = useState("");
  const [isCheckingDepositor, setIsCheckingDepositor] = useState(false);
  const { address, isManaged, isCustodial } = useWallet();
  const { balance: walletBalance } = useWalletBalance();
  const { data: granteeGrants } = useGranteeGrants(address);
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

      event(AnalyticsEvents.USE_DEPOSITOR, {
        category: "deployments",
        label: "Use depositor to deposit in deployment"
      });
    } else if (depositData && amountInDenom > depositData?.balance) {
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
      actions={[
        {
          label: "Cancel",
          color: "primary",
          variant: "ghost",
          side: "left",
          onClick: onClose
        },
        {
          label: "Continue",
          color: "secondary",
          variant: "default",
          side: "right",
          disabled: !amount || isCheckingDepositor || (useDepositor && validGrants.length === 0) || !walletBalance,
          isLoading: isCheckingDepositor,
          onClick: onDepositClick
        }
      ]}
      onClose={onClose}
      maxWidth="xs"
      enableCloseOnBackdropClick
      title="Deployment Deposit"
    >
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
