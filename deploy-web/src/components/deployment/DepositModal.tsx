import { ReactNode, useEffect, useState } from "react";
import { Popup } from "../shared/Popup";
import { Box, Checkbox, FormControlLabel, Paper, TextField } from "@mui/material";
import { useKeplr } from "@src/context/KeplrWalletProvider";
import SendIcon from "@mui/icons-material/Send";
import { AKTAmountInput } from "../shared/AKTAmountInput";
import { denomToUdenom } from "@src/utils/mathHelpers";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";

type Props = {
  open: boolean;
  onClose: () => void;
  owner: string;
  dseq: string;
  children?: ReactNode;
};

export const DepositModal: React.FunctionComponent<Props> = ({ open, owner, dseq, onClose }) => {
  const [amount, setAmount] = useState<number>(1);
  const [useDepositor, setUseDepositor] = useState<boolean>(false);
  const [depositor, setDepositor] = useState<string>("");
  const [isKeplrOpened, setIsKeplrOpened] = useState(false);
  const { signAndBroadcastTx } = useKeplr();

  useEffect(() => {
    setAmount(1);
    setUseDepositor(false);
    setDepositor("");
  }, [open]);

  async function onDepositClick() {
    setIsKeplrOpened(true);
    const depositorAddress = useDepositor && depositor ? depositor : owner;

    const message = TransactionMessageData.getDepositDeploymentMsg(owner, dseq, denomToUdenom(amount), depositorAddress);
    const success = await signAndBroadcastTx([message]);
    setIsKeplrOpened(false);

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
      title={<>Deposit AKT to deployment #{dseq}</>}
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
              Deposit&nbsp;
              <SendIcon />
            </>
          ),
          color: "secondary",
          variant: "contained",
          side: "right",
          disabled: !amount || isKeplrOpened,
          onClick: onDepositClick
        }
      ]}
      onClose={onCloseClick}
      maxWidth="sm"
      enableCloseOnBackdropClick={!isKeplrOpened}
    >
      <Paper elevation={2} sx={{ display: "flex", padding: "1rem" }}>
        <Box sx={{ flexGrow: 1 }}>
          <AKTAmountInput disabled={isKeplrOpened} amount={amount} onAmountChange={setAmount} />
          <FormControlLabel
            control={<Checkbox color="secondary" checked={useDepositor} onChange={ev => setUseDepositor(ev.target.checked)} />}
            label="Use depositor"
          />
          {useDepositor && (
            <Box>
              <TextField autoFocus label="Depositor address" fullWidth value={depositor} onChange={e => setDepositor(e.target.value)} />
            </Box>
          )}
        </Box>
      </Paper>
    </Popup>
  );
};
