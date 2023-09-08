import { useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { FormControl, TextField, Typography, Box, Alert, Select, MenuItem, InputLabel } from "@mui/material";
import { addYears, format } from "date-fns";
import { makeStyles } from "tss-react/mui";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { aktToUakt, coinToDenom } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { LinkTo } from "../shared/LinkTo";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { GrantType } from "@src/types/grant";
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
  editingGrant?: GrantType;
  onClose: () => void;
};

const supportedTokens = [
  { id: "akt", label: "AKT" },
  { id: "usdc", label: "USDC" }
];

export const GrantModal: React.FunctionComponent<Props> = ({ editingGrant, address, onClose }) => {
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
      token: editingGrant ? (editingGrant.authorization.spend_limit.denom === usdcDenom ? "usdc" : "akt") : "akt",
      amount: editingGrant ? coinToDenom(editingGrant.authorization.spend_limit) : 0,
      expiration: format(addYears(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
      useDepositor: false,
      granteeAddress: editingGrant?.grantee ?? ""
    }
  });
  const { amount, granteeAddress, expiration, token } = watch();
  const selectedToken = supportedTokens.find(x => x.id === token);
  const denom = token === "akt" ? uAktDenom : usdcDenom;
  const depositData = useDenomData(denom);

  const onDepositClick = event => {
    event.preventDefault();
    formRef.current.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  const onSubmit = async ({ amount }) => {
    setError("");
    clearErrors();
    const spendLimit = token === "akt" ? aktToUakt(amount) : denomToUdenom(amount);
    const usdcDenom = getUsdcDenom();
    const denom = token === "akt" ? uAktDenom : usdcDenom;

    const expirationDate = new Date(expiration);
    const message = TransactionMessageData.getGrantMsg(address, granteeAddress, spendLimit, expirationDate, denom);
    const response = await signAndBroadcastTx([message]);

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
    setValue("amount", depositData.inputMax);
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
      title="Authorize Spending"
    >
      <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
        <Alert severity="info" sx={{ marginBottom: "1rem" }}>
          <Typography variant="caption">
            <LinkTo
              onClick={ev =>
                handleDocClick(
                  ev,
                  "https://docs.akash.network/features/authorized-spend/relevant-commands-and-example-use#authorize-another-wallet-to-deploy-using-your-tokens"
                )
              }
            >
              Authorized Spend
            </LinkTo>{" "}
            allows users to authorize spend of a set number of tokens from a source wallet to a destination, funded wallet. The authorized spend is restricted
            to Akash deployment activities and the recipient of the tokens would not have access to those tokens for other operations.
          </Typography>
        </Alert>

        <Box marginBottom=".5rem" marginTop=".5rem" textAlign="right">
          <LinkTo onClick={() => onBalanceClick()}>
            Balance: {depositData?.balance} {depositData?.label}
          </LinkTo>
        </Box>

        <FormControl className={classes.formControl} fullWidth sx={{ display: "flex", alignItems: "center", flexDirection: "row" }}>
          <InputLabel id="grant-token">Token</InputLabel>
          <Controller
            control={control}
            name="token"
            defaultValue=""
            rules={{
              required: true
            }}
            render={({ fieldState, field }) => {
              return (
                <Select {...field} labelId="grant-token" label="Token" size="medium" error={!!fieldState.error}>
                  {supportedTokens.map(token => (
                    <MenuItem key={token.id} value={token.id}>
                      {token.label}
                    </MenuItem>
                  ))}
                </Select>
              );
            }}
          />

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
                  inputProps={{ min: 0, step: 0.000001 }}
                  sx={{ flexGrow: 1, marginLeft: "1rem" }}
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
                  disabled={!!editingGrant}
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
              This address will be able to spend up to {amount} {selectedToken.label} on your behalf ending on{" "}
              <FormattedDate value={expiration} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />.
            </Typography>
          </Alert>
        )}

        {error && <Alert severity="warning">{error}</Alert>}
      </form>
    </Popup>
  );
};
