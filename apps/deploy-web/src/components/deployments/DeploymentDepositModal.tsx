"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import compareAsc from "date-fns/compareAsc";
import { event } from "nextjs-google-analytics";
import { useSnackbar } from "notistack";

import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { useGranteeGrants } from "@src/queries/useGrantsQuery";
import { AnalyticsEvents } from "@src/utils/analytics";
import { uAktDenom } from "@src/utils/constants";
import { denomToUdenom, udenomToDenom } from "@src/utils/mathHelpers";
import { coinToUDenom, uaktToAKT } from "@src/utils/priceUtils";
import { LinkTo } from "../shared/LinkTo";
import { Popup } from "../shared/Popup";
import { Snackbar } from "../shared/Snackbar";
import { Alert } from "../ui/alert";
import { CheckboxWithLabel } from "../ui/checkbox";
import { FormItem } from "../ui/form";
import { InputWithIcon } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { GranteeDepositMenuItem } from "./GranteeDepositMenuItem";

type Props = {
  infoText?: string | ReactNode;
  disableMin?: boolean;
  denom: string;
  onDeploymentDeposit: (deposit: number, depositorAddress: string) => void;
  handleCancel: () => void;
  children?: ReactNode;
};

export const DeploymentDepositModal: React.FunctionComponent<Props> = ({ handleCancel, onDeploymentDeposit, disableMin, denom, infoText = null }) => {
  const formRef = useRef<HTMLFormElement>(null);
  const { settings } = useSettings();
  const { enqueueSnackbar } = useSnackbar();
  const [error, setError] = useState("");
  const [isCheckingDepositor, setIsCheckingDepositor] = useState(false);
  const { walletBalances, address } = useWallet();
  const { data: granteeGrants } = useGranteeGrants(address);
  const depositData = useDenomData(denom);
  const {
    handleSubmit,
    control,
    formState: { errors },
    watch,
    setValue,
    clearErrors,
    unregister
  } = useForm({
    defaultValues: {
      amount: 0,
      useDepositor: false,
      depositorAddress: ""
    }
  });
  const { amount, useDepositor, depositorAddress } = watch();
  const usdcIbcDenom = useUsdcDenom();
  const validGrants = granteeGrants?.filter(x => compareAsc(new Date(), x.authorization.expiration) !== 1 && x.authorization.spend_limit.denom === denom) || [];

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
    setValue("amount", depositData?.inputMax || 0);
  };

  const onDepositClick = event => {
    event.preventDefault();
    formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  const onSubmit = async ({ amount }) => {
    setError("");
    clearErrors();
    const deposit = denomToUdenom(amount);
    const uaktBalance = walletBalances?.uakt || 0;
    const usdcBalance = walletBalances?.usdc || 0;

    if (!disableMin && deposit < (depositData?.min || 0)) {
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
    } else if (denom === uAktDenom && deposit > uaktBalance) {
      setError(`You can't deposit more than you currently have in your balance. Current balance is: ${uaktToAKT(uaktBalance)} AKT.`);
      return;
    } else if (denom === usdcIbcDenom && deposit > usdcBalance) {
      setError(`You can't deposit more than you currently have in your balance. Current balance is: ${udenomToDenom(usdcBalance)} USDC.`);
      return;
    }

    onDeploymentDeposit(deposit, depositorAddress as string);
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
          disabled: !amount || isCheckingDepositor || (useDepositor && validGrants.length === 0),
          isLoading: isCheckingDepositor,
          onClick: onDepositClick
        }
      ]}
      onClose={onClose}
      maxWidth="xs"
      enableCloseOnBackdropClick
      title="Deployment Deposit"
    >
      <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
        {infoText}

        <FormItem
          className="w-full"
          // error={!errors.amount} fullWidth
        >
          <Controller
            control={control}
            name="amount"
            rules={{
              required: true
            }}
            render={({ fieldState, field }) => {
              const helperText = fieldState.error?.type === "validate" ? "Invalid amount." : "Amount is required.";

              return (
                <InputWithIcon
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
                  error={fieldState.error && helperText}
                  // helperText={fieldState.error && helperText}
                  min={!disableMin ? depositData?.min : 0}
                  step={0.000001}
                  max={depositData?.inputMax}
                  startIcon={depositData?.label}
                />
              );
            }}
          />
        </FormItem>

        <FormItem className="my-4 flex items-center">
          <Controller
            control={control}
            name="useDepositor"
            render={({ field }) => {
              return <CheckboxWithLabel label="Use another address to fund" checked={field.value} onCheckedChange={field.onChange} />;
            }}
          />
        </FormItem>

        {useDepositor && (
          <Controller
            control={control}
            name="depositorAddress"
            defaultValue=""
            rules={{
              required: true
            }}
            render={({ fieldState, field }) => {
              return (
                <FormItem
                  className="mt-2 w-full"
                  // error={fieldState.error}
                >
                  <Label htmlFor="deposit-grantee-address">Address</Label>
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
    </Popup>
  );
};
