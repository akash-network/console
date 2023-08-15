import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import formatDistanceToNow from "date-fns/formatDistanceToNow";
import isValid from "date-fns/isValid";
import { makeStyles } from "tss-react/mui";
import { getAvgCostPerMonth, uaktToAKT, useRealTimeLeft } from "@src/utils/priceUtils";
import { Box } from "@mui/material";
import { PriceValue } from "../shared/PriceValue";
import { PricePerMonth } from "../shared/PricePerMonth";
import { StatusPill } from "../shared/StatusPill";
import { CustomTooltip } from "../shared/CustomTooltip";
import { LabelValue } from "../shared/LabelValue";

const useStyles = makeStyles()(theme => ({
  warningIcon: {
    color: theme.palette.error.main
  }
}));

export function DeploymentSubHeader({ deployment, leases }) {
  const { classes } = useStyles();
  const hasLeases = leases && leases.length > 0;
  const deploymentCost = hasLeases ? leases.reduce((prev, current) => prev + current.price.amount, 0) : 0;
  const realTimeLeft = useRealTimeLeft(deploymentCost, deployment.escrowBalance, deployment.escrowAccount.settled_at, deployment.createdAt);
  const avgCost = uaktToAKT(getAvgCostPerMonth(deploymentCost));
  const isActive = deployment.state === "active";
  const hasActiveLeases = hasLeases && leases.some(l => l.state === "active");

  return (
    <Box
      sx={{
        gridTemplateColumns: { xs: "repeat(2,1fr)", sm: "repeat(2,1fr)", md: "repeat(2,1fr)" },
        display: "grid",
        gap: { xs: "1rem", sm: "1rem", md: "1rem" },
        padding: "1rem"
      }}
    >
      <Box>
        <LabelValue
          label="Balance"
          labelWidth="6rem"
          value={
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <PriceValue value={uaktToAKT(isActive && hasActiveLeases ? realTimeLeft?.escrow : deployment.escrowBalance, 6)} />
              <CustomTooltip
                arrow
                title={
                  <>
                    <strong>{uaktToAKT(isActive && hasActiveLeases ? realTimeLeft?.escrow : deployment.escrowBalance, 6)}&nbsp;AKT</strong>
                    <br />
                    The escrow account balance will be fully returned to your wallet balance when the deployment is closed.{" "}
                  </>
                }
              >
                <InfoIcon fontSize="small" color="disabled" sx={{ marginLeft: ".5rem" }} />
              </CustomTooltip>

              {isActive && hasActiveLeases && !!realTimeLeft && realTimeLeft.escrow <= 0 && (
                <CustomTooltip
                  arrow
                  title="Your deployment is out of funds and can be closed by your provider at any time now. You can add funds to keep active."
                >
                  <WarningIcon color="error" sx={{ marginLeft: ".5rem" }} className={classes.warningIcon} />
                </CustomTooltip>
              )}
            </Box>
          }
        />
        <LabelValue
          label="Cost"
          labelWidth="6rem"
          value={
            !!deploymentCost && (
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <PricePerMonth perBlockValue={uaktToAKT(deploymentCost, 6)} typoVariant="body1" />

                <CustomTooltip arrow title={<span>{avgCost} AKT / month</span>}>
                  <InfoIcon fontSize="small" color="disabled" sx={{ marginLeft: ".5rem" }} />
                </CustomTooltip>
              </Box>
            )
          }
        />
        <LabelValue
          label="Spent"
          labelWidth="6rem"
          value={
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <PriceValue value={uaktToAKT(isActive && hasActiveLeases ? realTimeLeft?.amountSpent : deployment.transferred.amount, 6)} />

              <CustomTooltip
                arrow
                title={<span>{uaktToAKT(isActive && hasActiveLeases ? realTimeLeft?.amountSpent : deployment.transferred.amount, 6)} AKT</span>}
              >
                <InfoIcon fontSize="small" color="disabled" sx={{ marginLeft: ".5rem" }} />
              </CustomTooltip>
            </Box>
          }
        />
      </Box>

      <Box>
        <LabelValue
          label="Status"
          labelWidth="6rem"
          value={
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <div>{deployment.state}</div>
              <StatusPill state={deployment.state} style={{ marginLeft: ".5rem" }} />
            </Box>
          }
        />
        <LabelValue label="Time left" labelWidth="6rem" value={isValid(realTimeLeft?.timeLeft) && `~${formatDistanceToNow(realTimeLeft?.timeLeft)}`} />
        <LabelValue label="DSEQ" labelWidth="6rem" value={deployment.dseq} />
      </Box>
    </Box>
  );
}
