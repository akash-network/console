import { useState, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { makeStyles } from "tss-react/mui";
import { txFeeBuffer } from "@src/utils/constants";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputAdornment, TextField } from "@mui/material";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import { aktToUakt, uaktToAKT } from "@src/utils/priceUtils";

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

export const SendModal = ({ onClose, onSendTransaction }) => {
  const { classes } = useStyles();
  const formRef = useRef(null);
  const [isBalanceClicked, setIsBalanceClicked] = useState(false);
  const [error, setError] = useState("");
  const { walletBalances } = useKeplr();
  const {
    handleSubmit,
    control,
    formState: { errors },
    watch,
    setValue,
    clearErrors
  } = useForm({
    defaultValues: {
      recipient: "",
      sendAmount: 0
    }
  });
  const { recipient } = watch();

  const onBalanceClick = () => {
    setIsBalanceClicked(prev => !prev);
    setError("");
    clearErrors();
    setValue("sendAmount", uaktToAKT(walletBalances.uakt - txFeeBuffer, 6));
  };

  const onSubmit = ({ sendAmount }) => {
    clearErrors();
    const amount = aktToUakt(sendAmount);

    if (!recipient) {
      setError(`You must set a recipient.`);
      return;
    }

    if (amount > walletBalances.uakt) {
      setError(`You can't send more than you currently have in your balance. Current balance is: ${uaktToAKT(amount, 6)}AKT.`);
      return;
    }

    onSendTransaction(recipient.trim(), amount);
  };

  const onContinueClick = event => {
    event.preventDefault();
    formRef.current.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };

  return (
    <Dialog maxWidth="xs" fullWidth aria-labelledby="send-transaction-dialog-title" open={true} onClose={onClose}>
      <DialogTitle id="send-transaction-dialog-title">Send tokens</DialogTitle>
      <DialogContent dividers className={classes.dialogContent}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          <FormControl error={!errors.recipient} fullWidth>
            <Controller
              control={control}
              name="recipient"
              rules={{
                required: true
              }}
              render={({ fieldState, field }) => {
                const helperText = "Recipient is required.";

                return (
                  <TextField
                    {...field}
                    type="text"
                    variant="outlined"
                    label="Recipient"
                    error={!!fieldState.invalid}
                    helperText={fieldState.invalid && helperText}
                  />
                );
              }}
            />
          </FormControl>

          <Box marginBottom=".5rem" marginTop=".5rem" textAlign="right">
            <a onClick={() => onBalanceClick()}>Balance: {uaktToAKT(walletBalances.uakt, 6)} AKT</a>
          </Box>

          <FormControl error={!errors.sendAmount} fullWidth>
            <Controller
              control={control}
              name="sendAmount"
              rules={{
                required: true,
                validate: value => value > 0 && value < walletBalances.uakt
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
                    inputProps={{ min: 0, step: 0.000001, max: uaktToAKT(walletBalances.uakt - txFeeBuffer, 6) }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">AKT</InputAdornment>,
                      endAdornment: isBalanceClicked && (
                        <InputAdornment position="end">
                          <Chip label="MAX" size="small" color="primary" />
                        </InputAdornment>
                      )
                    }}
                    disabled={isBalanceClicked}
                  />
                );
              }}
            />
          </FormControl>
          {error && (
            <Alert severity="warning" className={classes.alert}>
              {error}
            </Alert>
          )}
        </form>
      </DialogContent>
      <DialogActions className={classes.dialogActions}>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onContinueClick} disabled={!!errors.sendAmount || !!errors.recipient} variant="contained" color="primary">
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};
