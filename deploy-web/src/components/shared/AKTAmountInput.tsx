import { Box, FormControl, InputAdornment, InputLabel, OutlinedInput } from "@mui/material";
import { useWallet } from "@src/context/WalletProvider";
import { FormattedDecimal } from "../shared/FormattedDecimal";
import { AKTLabel } from "../shared/AKTLabel";
import { FormattedNumber } from "react-intl";
import { usePricing } from "@src/context/PricingProvider";

type Props = {
  disabled?: boolean;
  amount: number;
  onAmountChange: (aktAmount: number) => void;
};

export const AKTAmountInput: React.FunctionComponent<Props> = ({ disabled, amount, onAmountChange }) => {
  const { walletBalances } = useWallet();
  const { isLoaded: isPricingLoaded, aktToUSD } = usePricing();

  const isValidAmount = !!amount;

  function onValueChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    const parsedValue = parseFloat(value);
    onAmountChange(isNaN(parsedValue) ? null : parsedValue);
  }

  return (
    <>
      {walletBalances && (
        <Box mb={1} sx={{ textAlign: "right" }}>
          Available Balance: <FormattedDecimal value={walletBalances.uakt / 1_000_000} />
          &nbsp;
          <AKTLabel />
        </Box>
      )}
      <FormControl variant="outlined" sx={{ width: "100%" }} disabled={disabled}>
        <InputLabel htmlFor="amount-field">Amount</InputLabel>
        <OutlinedInput
          id="amount-field"
          type="number"
          value={typeof amount === "number" ? amount : ""}
          label="Amount"
          onChange={onValueChange}
          endAdornment={<InputAdornment position="end">AKT</InputAdornment>}
        />
      </FormControl>
      {isPricingLoaded && isValidAmount && (
        <Box mt={1} sx={{ textAlign: "right" }}>
          ~<FormattedNumber style="currency" currency="USD" value={aktToUSD(amount)} />
        </Box>
      )}
    </>
  );
};

