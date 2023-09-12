import { useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { FormControl, TextField, Typography, Box, Alert, Select, MenuItem, InputLabel, InputAdornment } from "@mui/material";
import { addYears, format } from "date-fns";
import { makeStyles } from "tss-react/mui";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { aktToUakt, coinToDenom } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { LinkTo } from "../shared/LinkTo";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { AllowanceType, GrantType } from "@src/types/grant";
import { Popup } from "../shared/Popup";
import { getUsdcDenom, useUsdcDenom } from "@src/hooks/useDenom";
import { denomToUdenom } from "@src/utils/mathHelpers";
import { useDenomData } from "@src/hooks/useWalletBalance";
import { uAktDenom } from "@src/utils/constants";
import { FormattedDate } from "react-intl";

const useStyles = makeStyles()(theme => ({
  formControl: {
    marginBottom: "1rem"
  }
}));

type Props = {
  address: string;
  editingAllowance?: AllowanceType;
  onClose: () => void;
};

export const AllowanceModal: React.FunctionComponent<Props> = ({ editingAllowance, address, onClose }) => {
  const formRef = useRef(null);
  const [error, setError] = useState("");
  const { classes } = useStyles();
  const { signAndBroadcastTx } = useKeplr();
  const usdcDenom = useUsdcDenom();
  const {
    handleSubmit,
    control,
    formState: { errors },
    watch,
    clearErrors,
    setValue
  } = useForm({
    defaultValues: {
      amount: editingAllowance ? coinToDenom(editingAllowance.allowance.spend_limit[0]) : 0,
      expiration: format(addYears(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
      useDepositor: false,
      granteeAddress: editingAllowance?.grantee ?? ""
    }
  });
  const { amount, granteeAddress, expiration } = watch();
  const denomData = useDenomData(uAktDenom);

  console.log(coinToDenom(editingAllowance.allowance.spend_limit[0]));

  const onDepositClick = event => {
    event.preventDefault();
    formRef.current.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  const onSubmit = async ({ amount }) => {
    setError("");
    clearErrors();

    const messages = [];
    const spendLimit = aktToUakt(amount);
    const expirationDate = new Date(expiration);

    if (editingAllowance) {
      messages.push(TransactionMessageData.getRevokeAllowanceMsg(address, granteeAddress));
    }
    messages.push(TransactionMessageData.getGrantBasicAllowanceMsg(address, granteeAddress, spendLimit, uAktDenom, expirationDate));
    const response = await signAndBroadcastTx(messages);

    if (response) {
      event(AnalyticsEvents.AUTHORIZE_SPEND, {
        category: "deployments",
        label: "Authorize wallet to spend on deployment deposits"
      });

      onClose();
    }
  };

  function handleDocClick(ev, url: string) {
    ev.preventDefault();

    window.open(url, "_blank");
  }

  const onBalanceClick = () => {
    clearErrors();
    setValue("amount", denomData?.inputMax);
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
          variant: "text",
          side: "left",
          onClick: onClose
        },
        {
          label: "Grant",
          color: "secondary",
          variant: "contained",
          side: "right",
          disabled: !amount,
          onClick: onDepositClick
        }
      ]}
      onClose={onClose}
      maxWidth="sm"
      enableCloseOnBackdropClick
      title="Authorize Fee Spending"
    >
      <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
        <Alert severity="info" sx={{ marginBottom: "1rem" }}>
          <Typography variant="caption">
            <LinkTo onClick={ev => handleDocClick(ev, "https://docs.cosmos.network/v0.46/modules/feegrant/")}>Authorized Fee Spend</LinkTo> allows users to
            authorize spend of a set number of tokens on fees from a source wallet to a destination, funded wallet.
          </Typography>
        </Alert>

        <Box marginBottom=".5rem" marginTop=".5rem" textAlign="right">
          <LinkTo onClick={() => onBalanceClick()}>
            Balance: {denomData?.balance} {denomData?.label}
          </LinkTo>
        </Box>

        <FormControl className={classes.formControl} fullWidth>
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
                  label="Spending Limit"
                  autoFocus
                  error={!!fieldState.error}
                  helperText={fieldState.error && helperText}
                  inputProps={{ min: 0, step: 0.000001, max: denomData?.inputMax }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">AKT</InputAdornment>
                  }}
                />
              );
            }}
          />
        </FormControl>

        <FormControl className={classes.formControl} fullWidth>
          <Controller
            control={control}
            name="granteeAddress"
            defaultValue=""
            rules={{
              required: true
            }}
            render={({ fieldState, field }) => {
              return (
                <TextField
                  {...field}
                  type="text"
                  variant="outlined"
                  label="Grantee Address"
                  disabled={!!editingAllowance}
                  error={!!fieldState.error}
                  helperText={fieldState.error && "Grantee address is required."}
                />
              );
            }}
          />
        </FormControl>

        <FormControl className={classes.formControl} fullWidth>
          <Controller
            control={control}
            name="expiration"
            rules={{
              required: true
            }}
            render={({ fieldState, field }) => {
              return (
                <TextField
                  {...field}
                  type="datetime-local"
                  variant="outlined"
                  label="Expiration"
                  error={!!fieldState.error}
                  helperText={fieldState.error && "Expiration is required."}
                />
              );
            }}
          />
        </FormControl>

        {!!amount && granteeAddress && (
          <Alert severity="info" variant="outlined">
            <Typography variant="caption">
              This address will be able to spend up to {amount} AKT on fees on your behalf ending on{" "}
              <FormattedDate value={expiration} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />.
            </Typography>
          </Alert>
        )}

        {error && <Alert severity="warning">{error}</Alert>}
      </form>
    </Popup>
  );
};
