import { ReactNode, useEffect, useState } from "react";
import { Popup } from "../shared/Popup";
import { Box, Paper } from "@mui/material";
import { useWallet } from "@src/context/WalletProvider";
import SendIcon from "@mui/icons-material/Send";
import { Address } from "../shared/Address";
import { AKTAmountInput } from "../shared/AKTAmountInput";
import { denomToUdenom } from "@src/utils/mathHelpers";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";

type Props = {
  open: boolean;
  onClose: () => void;
  toAddress: string;
  children?: ReactNode;
};

export const SendAktModal: React.FunctionComponent<Props> = ({ open, toAddress, onClose }) => {
  const [amount, setAmount] = useState<number>(1);
  const [isKeplrOpened, setIsKeplrOpened] = useState(false);
  const { signAndBroadcastTx, address } = useWallet();

  useEffect(() => {
    setAmount(1);
  }, [open]);

  async function onSendClick() {
    setIsKeplrOpened(true);
    const success = await signAndBroadcastTx([
      {
        typeUrl: "/cosmos.bank.v1beta1.MsgSend",
        value: MsgSend.fromJSON({
          fromAddress: address,
          toAddress: toAddress,
          amount: [{ denom: "uakt", amount: denomToUdenom(amount).toString() }]
        })
      }
    ]);

    setIsKeplrOpened(false);

    event(AnalyticsEvents.ADDRESSES_SEND_TOKENS, {
      category: "addresses",
      label: "Sent tokens"
    });

    if (success) {
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
      title={
        <>
          Sending AKT to <Address address={address} />
        </>
      }
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
              Send&nbsp;
              <SendIcon />
            </>
          ),
          color: "secondary",
          variant: "contained",
          side: "right",
          disabled: !amount || isKeplrOpened,
          onClick: onSendClick
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

