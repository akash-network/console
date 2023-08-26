import { useState, useRef, useEffect, ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { useSettings } from "../../context/SettingsProvider";
import { useSnackbar } from "notistack";
import compareAsc from "date-fns/compareAsc";
import { makeStyles } from "tss-react/mui";
import { aktToUakt, coinToUAkt, uaktToAKT } from "@src/utils/priceUtils";
import { Snackbar } from "../shared/Snackbar";
import { txFeeBuffer } from "@src/utils/constants";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Select,
  TextField
} from "@mui/material";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { LinkTo } from "../shared/LinkTo";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { Address } from "../shared/Address";
import { FormattedDate } from "react-intl";
import { AKTAmount } from "../shared/AKTAmount";
import { useGranteeGrants } from "@src/queries/useGrantsQuery";

const useStyles = makeStyles()(theme => ({
  alert: {
    marginTop: "1rem"
  },
  dialogContent: {
    padding: "1rem"
  },
  dialogActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  }
}));

type Props = {
  infoText?: string | ReactNode;
  min?: number;
  denom: string;
  onDeploymentDeposit: (deposit: number, depositorAddress: string) => void;
  handleCancel: () => void;
  children?: ReactNode;
};

export const DeploymentDepositModal: React.FunctionComponent<Props> = ({ handleCancel, onDeploymentDeposit, denom, min = 0, infoText = null }) => {
  const { classes } = useStyles();
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

      // TODO handle other than v1beta2
      const grant = data.grants?.find(x => x.authorization["@type"] === "/akash.deployment.v1beta2.DepositDeploymentAuthorization");

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

      let spendLimitUAkt = coinToUAkt(grant.authorization.spend_limit);

      if (depositAmount > spendLimitUAkt) {
        setError(`Spend limit remaining: ${uaktToAKT(spendLimitUAkt)}akt`);
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
    setValue("amount", uaktToAKT(walletBalances.uakt - txFeeBuffer, 6));
  };

  const onDepositClick = event => {
    event.preventDefault();
    formRef.current.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  const onSubmit = async ({ amount }) => {
    setError("");
    clearErrors();
    const deposit = aktToUakt(amount);

    if (deposit < aktToUakt(min)) {
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
    } else if (deposit > walletBalances.uakt) {
      setError(`You can't deposit more than you currently have in your balance. Current balance is: ${uaktToAKT(walletBalances.uakt)}AKT.`);
      return;
    }

    onDeploymentDeposit(deposit, depositorAddress);
  };

  return (
    <Dialog maxWidth="xs" fullWidth aria-labelledby="deposit-deployment-dialog-title" open={true} onClose={onClose}>
      <DialogTitle id="deposit-deployment-dialog-title">Deployment Deposit</DialogTitle>
      <DialogContent dividers className={classes.dialogContent}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          {infoText}

          <Box marginBottom=".5rem" marginTop={infoText ? 0 : ".5rem"} textAlign="right">
            <LinkTo onClick={() => onBalanceClick()}>Balance: {uaktToAKT(walletBalances.uakt, 6)} AKT</LinkTo>
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
                    inputProps={{ min: min, step: 0.000001, max: uaktToAKT(walletBalances.uakt - txFeeBuffer, 6) }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">AKT</InputAdornment>
                    }}
                  />
                );
              }}
            />
          </FormControl>

          <FormControl fullWidth>
            <Controller
              control={control}
              name="useDepositor"
              render={({ fieldState, field }) => {
                return <FormControlLabel control={<Checkbox {...field} color="secondary" />} label="Use another address to fund" />;
              }}
            />
          </FormControl>

          {useDepositor && (
            <FormControl fullWidth>
              <FormControl fullWidth>
                <Controller
                  control={control}
                  name="depositorAddress"
                  defaultValue=""
                  rules={{
                    required: true
                  }}
                  render={({ fieldState, field }) => {
                    return (
                      <Select labelId="theme-select" {...field} label="Theme" size="small">
                        {granteeGrants
                          .filter(x => compareAsc(new Date(), x.authorization.expiration) !== 1)
                          .map(grant => (
                            <MenuItem key={grant.granter} value={grant.granter}>
                              <Address address={grant.granter} />
                              &nbsp;&nbsp;&nbsp;
                              <AKTAmount uakt={coinToUAkt(grant.authorization.spend_limit)} />
                              AKT &nbsp;
                              <small>
                                (Exp:&nbsp;
                                <FormattedDate value={new Date(grant.expiration)} />
                              </small>
                              )
                            </MenuItem>
                          ))}
                      </Select>
                    );
                  }}
                />
              </FormControl>
            </FormControl>
          )}

          {error && (
            <Alert severity="warning" className={classes.alert}>
              {error}
            </Alert>
          )}
        </form>
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button autoFocus onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onDepositClick} disabled={!amount || isCheckingDepositor} variant="contained" color="secondary">
          {isCheckingDepositor ? <CircularProgress size="24px" color="secondary" /> : "Deposit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
