import { Button, Dialog, DialogContent, DialogActions, Typography, Box, Paper, useTheme } from "@mui/material";
import { useKeplr } from "@src/context/KeplrWalletProvider";
// import { feePercent, maxFee } from "@src/utils/constants";
import { FormattedNumber } from "react-intl";
import { makeStyles } from "tss-react/mui";
import { LinkTo } from "../shared/LinkTo";

const useStyles = makeStyles()(theme => ({
  dialogContent: {
    padding: "1rem"
  }
}));

export const WelcomeModal = ({ open, onClose }) => {
  const { classes } = useStyles();
  const theme = useTheme();

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogContent className={classes.dialogContent}>
        <Typography variant="h3" sx={{ fontSize: "2rem" }}>
          <strong>Welcome!</strong>
        </Typography>
        <Paper elevation={2} sx={{ padding: "1rem", margin: "1rem 0 0", backgroundColor: theme.palette.mode === "dark" ? "" : theme.palette.grey[200] }}>
          <Typography variant="body2" color="textSecondary">
            Thank you for choosing Cloudmos Deploy!
          </Typography>
          <br />
          <Typography variant="body2" color="textSecondary">
            We hope you enjoy using our platform and look forward to continuing to provide you with excellent service. We are excited to have you as a user and
            look forward to helping you build your business.
          </Typography>
          <Typography variant="body1" sx={{ marginBottom: "1rem", marginTop: "1.5rem" }}>
            Disclaimer
          </Typography>

          <Typography variant="body2" color="textSecondary">
            Our app is currently in the BETA stage, which means that we are still in the process of testing and improving it. To ensure a safe and enjoyable
            experience, we recommend that you create a new wallet and start with a small amount of AKT/USDC.
            <br />
            <br />
            Please note that while we are doing our best to make sure the app is safe and functional, there may be some bugs and issues that we haven't
            discovered yet. As with any BETA product, use at your own discretion.
            <br />
            <br />
            We appreciate your understanding and support as we work to make Cloudmos Deploy even better. If you encounter any problems or have suggestions for
            improvement, please don't hesitate to reach out to us. We're here to help!
          </Typography>
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose} type="button" color="secondary">
          I accept
        </Button>
      </DialogActions>
    </Dialog>
  );
};
