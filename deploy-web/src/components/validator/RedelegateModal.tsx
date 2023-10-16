import { ReactNode, useState } from "react";
import { Popup } from "../shared/Popup";
import { Box, FormControl, InputLabel, MenuItem, Paper, Select, SelectChangeEvent } from "@mui/material";
import { useWallet } from "@src/context/WalletProvider";
import SendIcon from "@mui/icons-material/Send";
import { AKTAmountInput } from "../shared/AKTAmountInput";
import { useValidators } from "@src/queries/useValidatorsQuery";
import { denomToUdenom } from "@src/utils/mathHelpers";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { MsgBeginRedelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";

type Props = {
  open: boolean;
  onClose: () => void;
  validatorAddress: string;
  validatorMoniker: string;
  delegatedAmount: number;
  children?: ReactNode;
};

export const RedelegateModal: React.FunctionComponent<Props> = ({ open, validatorAddress, validatorMoniker, onClose }) => {
  const [amount, setAmount] = useState<number>(1);
  const [selectedValidator, setSelectedValidator] = useState<string>("");
  const [isKeplrOpened, setIsKeplrOpened] = useState(false);
  const { data: validators, isLoading } = useValidators();
  const { signAndBroadcastTx, address } = useWallet();

  async function onRedelegateClick() {
    setIsKeplrOpened(true);
    const success = await signAndBroadcastTx([
      {
        typeUrl: "/cosmos.staking.v1beta1.MsgBeginRedelegate",
        value: MsgBeginRedelegate.fromJSON({
          delegatorAddress: address,
          validatorSrcAddress: validatorAddress,
          validatorDstAddress: selectedValidator,
          amount: {
            amount: denomToUdenom(amount).toString(),
            denom: "uakt"
          }
        })
      }
    ]);
    setIsKeplrOpened(false);

    if (success) {
      event(AnalyticsEvents.VALIDATORS_REDELEGATE, {
        category: "validators",
        label: "Redelegate validator"
      });

      onClose();
    }
  }

  function onCloseClick() {
    if (!isKeplrOpened) {
      onClose();
    }
  }

  function handleChange(event: SelectChangeEvent) {
    setSelectedValidator(event.target.value as string);
  }

  return (
    <Popup
      fullWidth
      open={open}
      variant="custom"
      title={<>Relegating from {validatorMoniker}</>}
      actions={[
        {
          label: "Cancel",
          color: "primary",
          variant: "text",
          side: "right",
          disabled: isKeplrOpened,
          onClick: onClose
        },
        {
          label: (
            <>
              Redelegate&nbsp;
              <SendIcon />
            </>
          ),
          color: "secondary",
          variant: "contained",
          side: "right",
          disabled: isKeplrOpened || !selectedValidator || !amount,
          onClick: onRedelegateClick
        }
      ]}
      onClose={onCloseClick}
      maxWidth="sm"
      enableCloseOnBackdropClick={!isKeplrOpened}
    >
      <Paper elevation={2} sx={{ display: "flex", padding: "1rem" }}>
        <Box sx={{ flexGrow: 1 }}>
          <FormControl disabled={isKeplrOpened} fullWidth>
            <InputLabel id="demo-simple-select-label">Redelegating to:</InputLabel>
            <Select
              labelId="demo-simple-select-label"
              value={selectedValidator}
              label="Redelegating to:"
              onChange={handleChange}
              MenuProps={{ disableScrollLock: true }}
            >
              {!isLoading &&
                validators.map(validator => (
                  <MenuItem key={validator.moniker} value={validator.operatorAddress}>
                    {validator.moniker}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <AKTAmountInput disabled={isKeplrOpened} amount={amount} onAmountChange={setAmount} />
        </Box>
      </Paper>
    </Popup>
  );
};

