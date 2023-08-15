import { useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputAdornment, TextField, Typography, Box, Alert } from "@mui/material";
import { addYears, format } from "date-fns";
import { makeStyles } from "tss-react/mui";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { aktToUakt, coinToAkt } from "@src/utils/priceUtils";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";
import { LinkTo } from "../shared/LinkTo";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { GrantType } from "@src/types/grant";

const useStyles = makeStyles()(theme => ({
  dialogContent: {
    textAlign: "center",
    padding: "1rem"
  },
  formControl: {
    marginTop: 10
  },
  dialogActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  }
}));

type Props = {
  address: string;
  editingGrant?: GrantType;
  onClose: () => void;
};

export const GrantModal: React.FunctionComponent<Props> = ({ editingGrant, address, onClose }) => {
  const formRef = useRef(null);
  const [error, setError] = useState("");
  const { classes } = useStyles();
  const { signAndBroadcastTx } = useKeplr();
  const {
    handleSubmit,
    control,
    formState: { errors },
    watch,
    clearErrors
  } = useForm({
    defaultValues: {
      amount: editingGrant ? coinToAkt(editingGrant.authorization.spend_limit).toString() : "",
      expiration: format(addYears(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
      useDepositor: false,
      granteeAddress: editingGrant?.grantee ?? ""
    }
  });
  const { amount, granteeAddress, expiration } = watch();

  const onDepositClick = event => {
    event.preventDefault();
    formRef.current.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  const onSubmit = async ({ amount }) => {
    setError("");
    clearErrors();
    const spendLimit = aktToUakt(amount);

    const expirationDate = new Date(expiration);
    const message = TransactionMessageData.getGrantMsg(address, granteeAddress, spendLimit, expirationDate);
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

  return (
    <Dialog maxWidth="xs" aria-labelledby="deposit-dialog-title" open={true} onClose={onClose}>
      <DialogTitle id="deposit-dialog-title">Authorize Spending</DialogTitle>
      <DialogContent dividers className={classes.dialogContent}>
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

          <FormControl error={!errors.amount} className={classes.formControl} fullWidth>
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
            <Box marginTop={1} textAlign={"left"}>
              <Typography variant="caption">This address will be able to spend up to {amount} AKT on your behalf.</Typography>
            </Box>
          )}

          {error && <Alert severity="warning">{error}</Alert>}
        </form>
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button autoFocus onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onDepositClick} disabled={!amount} variant="contained" color="secondary">
          Grant
        </Button>
      </DialogActions>
    </Dialog>
  );
};
