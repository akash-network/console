import { ReactNode } from "react";
import { Popup } from "../shared/Popup";
import { Box, CircularProgress, Typography } from "@mui/material";

type Props = {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
};

export const TransactionModal: React.FunctionComponent<Props> = ({ open, onClose }) => {
  return (
    <Popup
      fullWidth
      open={open}
      variant="custom"
      title={<>Transaction Pending</>}
      actions={[]}
      onClose={onClose}
      maxWidth="xs"
      enableCloseOnBackdropClick={false}
    >
      <Box sx={{ padding: "1rem", textAlign: "center" }}>
        <Box sx={{ margin: "2rem 0 3rem" }}>
          <CircularProgress size="5rem" color="secondary" />
        </Box>

        <div>
          <Typography variant="caption">BROADCASTING TRANSACTION...</Typography>
        </div>
      </Box>
    </Popup>
  );
};
