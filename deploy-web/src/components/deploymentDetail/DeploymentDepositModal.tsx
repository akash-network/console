import { useState, useRef, useEffect, ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { useSettings } from "../../context/SettingsProvider";
import { useSnackbar } from "notistack";
import compareAsc from "date-fns/compareAsc";
import { coinToUDenom, uaktToAKT } from "@src/utils/priceUtils";
import { Snackbar } from "../shared/Snackbar";
import { uAktDenom } from "@src/utils/constants";
import { Alert, Box, Checkbox, FormControl, FormControlLabel, InputAdornment, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { LinkTo } from "../shared/LinkTo";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { Address } from "../shared/Address";
import { FormattedDate } from "react-intl";
import { AKTAmount } from "../shared/AKTAmount";
import { useGranteeGrants } from "@src/queries/useGrantsQuery";
import { denomToUdenom, udenomToDenom } from "@src/utils/mathHelpers";
import { Popup } from "../shared/Popup";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { useUsdcDenom } from "@src/hooks/useDenom";
import { GranteeDepositMenuItem } from "./GranteeDepositMenuItem";

type Props = {
  infoText?: string | ReactNode;
  min?: number;
  denom: string;
  onDeploymentDeposit: (deposit: number, depositorAddress: string) => void;
  handleCancel: () => void;
  children?: ReactNode;
};

export const DeploymentDepositModal: React.FunctionComponent<Props> = ({ handleCancel, onDeploymentDeposit, denom, min = 0, infoText = null }) => {
  const formRef = useRef(null);
  const { settings } = useSettings();
  const { enqueueSnackbar } = useSnackbar();
  const [error, setError] = useState("");
  const [isCheckingDepositor, setIsCheckingDepositor] = useState(false);
  const { walletBalances, address } = useKeplr();
  const { data: granteeGrants } = useGranteeGrants(address);
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
      amount: min,
      useDepositor: false,
      depositorAddress: ""
    }
  });
  const { amount, useDepositor, depositorAddress } = watch();
  const depositData = useDenomData(denom);
  const usdcIbcDenom = useUsdcDenom();

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

      let spendLimitUDenom = coinToUDenom(grant.authorization.spend_limit);

      if (depositAmount > spendLimitUDenom) {
        setError(`Spend limit remaining: ${udenomToDenom(spendLimitUDenom)} ${depositData.label}`);
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
    setValue("amount", depositData.inputMax);
  };

  const onDepositClick = event => {
    event.preventDefault();
    formRef.current.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  const onSubmit = async ({ amount }) => {
    setError("");
    clearErrors();
    const deposit = denomToUdenom(amount);

    if (deposit < denomToUdenom(min)) {
      setError(`Deposit amount must be greater or equal than ${min}.`);
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
    } else if (denom === uAktDenom && deposit > walletBalances.uakt) {
      setError(`You can't deposit more than you currently have in your balance. Current balance is: ${uaktToAKT(walletBalances.uakt)} AKT.`);
      return;
    } else if (denom === usdcIbcDenom && deposit > walletBalances.usdc) {
      setError(`You can't deposit more than you currently have in your balance. Current balance is: ${udenomToDenom(walletBalances.usdc)} USDC.`);
      return;
    }

    onDeploymentDeposit(deposit, depositorAddress);
  };

  console.log(denom)

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      actions={[
        {
          label: "Cancel",
          color: "primary",
          variant: "text",
          side: "left",
          onClick: onClose
        },
        {
          label: "Continue",
          color: "secondary",
          variant: "contained",
          side: "right",
          disabled: !amount || isCheckingDepositor,
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

        <Box marginBottom=".5rem" marginTop={infoText ? 0 : ".5rem"} textAlign="right">
          <LinkTo onClick={() => onBalanceClick()}>
            Balance: {depositData?.balance} {depositData?.label}
          </LinkTo>
        </Box>

        <FormControl error={!errors.amount} fullWidth>
          <Controller
            control={control}
            name="amount"
            rules={{
              required: true
            }}
            render={({ fieldState, field }) => {
              const helperText = fieldState.error?.type === "validate" ? "Invalid amount." : "Amount is required.";

              return (
                <TextField
                  {...field}
                  type="number"
                  variant="outlined"
                  label="Amount"
                  autoFocus
                  error={!!fieldState.error}
                  helperText={fieldState.error && helperText}
                  inputProps={{ min: min, step: 0.000001, max: depositData?.inputMax }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">{depositData?.label}</InputAdornment>
                  }}
                />
              );
            }}
          />
        </FormControl>

        <FormControl>
          <Controller
            control={control}
            name="useDepositor"
            render={({ fieldState, field }) => {
              return <FormControlLabel control={<Checkbox {...field} color="secondary" />} label="Use another address to fund" />;
            }}
          />
        </FormControl>

        {useDepositor && (
          <FormControl fullWidth sx={{ marginTop: ".5rem" }}>
            <InputLabel id="deposit-grantee-address">Address</InputLabel>
            <Controller
              control={control}
              name="depositorAddress"
              defaultValue=""
              rules={{
                required: true
              }}
              render={({ fieldState, field }) => {
                return (
                  <Select {...field} labelId="deposit-grantee-address" label="Address" error={!!fieldState.error}>
                    {granteeGrants
                      .filter(x => compareAsc(new Date(), x.authorization.expiration) !== 1 && x.authorization.spend_limit.denom === denom)
                      .map(grant => (
                        <MenuItem key={grant.granter} value={grant.granter}>
                          <GranteeDepositMenuItem grant={grant} />
                        </MenuItem>
                      ))}
                  </Select>
                );
              }}
            />
          </FormControl>
        )}

        {error && (
          <Alert severity="warning" sx={{ marginTop: "1rem" }}>
            {error}
          </Alert>
        )}
      </form>
    </Popup>
  );
};
