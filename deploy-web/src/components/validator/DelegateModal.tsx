import { ReactNode, useState } from "react";
import { Popup } from "../shared/Popup";
import { Box, Paper } from "@mui/material";
import { useWallet } from "@src/context/WalletProvider";
import SendIcon from "@mui/icons-material/Send";
import { AKTAmountInput } from "../shared/AKTAmountInput";
import { denomToUdenom } from "@src/utils/mathHelpers";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";

type Props = {
  open: boolean;
  onClose: () => void;
  validatorAddress: string;
  validatorMoniker: string;
  children?: ReactNode;
};

export const DelegateModal: React.FunctionComponent<Props> = ({ open, validatorAddress, validatorMoniker, onClose }) => {
  const [amount, setAmount] = useState<number>(1);
  const [isKeplrOpened, setIsKeplrOpened] = useState(false);
  const { signAndBroadcastTx, address } = useWallet();

  async function onDelegateClick() {
    setIsKeplrOpened(true);
    const success = await signAndBroadcastTx([
      {
        typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
        value: MsgDelegate.fromJSON({
          delegatorAddress: address,
          validatorAddress: validatorAddress,
          amount: {
            amount: denomToUdenom(amount).toString(),
            denom: "uakt"
          }
        })
      }
    ]);

    setIsKeplrOpened(false);

    if (success) {
      event(AnalyticsEvents.VALIDATORS_DELEGATE, {
        category: "validators",
        label: "Delegate validator"
      });

      onClose();
    }
  }

  function onCloseClick() {
    if (!isKeplrOpened) {
      onClose();
    }
  }

  return (
    <Popup
      fullWidth
      open={open}
      variant="custom"
      title={<>Delegating to {validatorMoniker}</>}
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
              Delegate&nbsp;
              <SendIcon />
            </>
          ),
          color: "secondary",
          variant: "contained",
          side: "right",
          disabled: !amount || isKeplrOpened,
          onClick: onDelegateClick
        }
      ]}
      onClose={onCloseClick}
      maxWidth="sm"
      enableCloseOnBackdropClick={!isKeplrOpened}
    >
      <Paper elevation={2} sx={{ display: "flex", padding: "1rem" }}>
        <Box sx={{ flexGrow: 1 }}>
          <AKTAmountInput disabled={isKeplrOpened} amount={amount} onAmountChange={setAmount} />
        </Box>
      </Paper>
    </Popup>
  );
};

