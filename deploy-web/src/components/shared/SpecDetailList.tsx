import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import SpeedIcon from "@mui/icons-material/Speed";
import DeveloperBoardIcon from "@mui/icons-material/DeveloperBoard";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import BlockIcon from "@mui/icons-material/Block";
import { makeStyles } from "tss-react/mui";
import { cx } from "@emotion/css";
import { Box, LinearProgress, Paper } from "@mui/material";
import { bytesToShrink } from "@src/utils/unitUtils";
import { roundDecimal } from "@src/utils/mathHelpers";

const useStyles = makeStyles()(theme => ({
  root: {
    display: "inline-block",
    alignItems: "center",
    flexDirection: "column",
    borderRadius: 0
  },
  defaultColor: {
    color: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[400],
    borderColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : "rgba(0,0,0,.2)"
  },
  activeColor: {
    color: theme.palette.mode === "dark" ? `${theme.palette.grey[500]} !important` : `${theme.palette.grey[700]} !important`,
    borderColor: theme.palette.mode === "dark" ? "rgba(0,0,0,.4) !important" : "rgba(0,0,0,.25) !important"
  },
  serverRow: {
    width: "110px",
    border: "1px solid",
    borderRightWidth: "2px",
    borderLeftWidth: "2px",
    textAlign: "center",
    display: "flex",
    alignItems: "center",
    padding: "2px 4px"
  },
  serverTop: {
    width: "100%",
    display: "flex",
    borderBottom: "12px solid",
    height: "16px",
    borderTop: "2px solid",
    borderRight: "1px solid",
    borderLeft: "1px solid",
    position: "relative"
  },
  serverDot: {
    position: "absolute",
    width: "4px",
    height: "4px",
    borderRadius: "4px",
    bottom: "-8px",
    backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[700] : theme.palette.secondary.contrastText
  },
  serverDotActive: {
    animation: "$glow 1s ease-in-out infinite alternate",
    backgroundColor: `${theme.palette.secondary.main} !important`
  },
  progressActive: {
    height: "2px",
    width: "100%",
    opacity: "0.25"
  },
  statusIcon: {
    position: "absolute",
    top: "3px",
    right: "4px",
    fontSize: ".7rem",
    opacity: 0.3,
    color: theme.palette.secondary.contrastText
  },
  activeIcon: {
    opacity: `1 !important`,
    color: theme.palette.secondary.main
  },
  specIcon: {
    fontSize: "1rem"
  },
  specDetail: {
    marginLeft: ".75rem",
    flexGrow: 1,
    textAlign: "left",
    fontWeight: "bold",

    fontSize: ".8rem",
    lineHeight: ".8rem"
  },
  "@keyframes glow": {
    "0%": {
      boxShadow: `0 0 0px ${theme.palette.secondary.main}, 0 0 2px ${theme.palette.secondary.main}, 0 0 4px ${theme.palette.secondary.main}`
    },
    "100%": {
      boxShadow: `0 0 4px ${theme.palette.secondary.main}, 0 0 6px ${theme.palette.secondary.main}, 0 0 8px ${theme.palette.secondary.main}`
    }
  }
}));

export function SpecDetailList({ cpuAmount, memoryAmount, storageAmount, gpuAmount = 0, isActive }) {
  const { classes } = useStyles();
  const memory = bytesToShrink(memoryAmount);
  const storage = bytesToShrink(storageAmount);

  return (
    <Paper className={classes.root} elevation={isActive ? 3 : 0}>
      <div className={cx(classes.serverTop, classes.defaultColor, { [classes.activeColor]: isActive })}>
        {isActive && (
          <>
            <LinearProgress className={cx(classes.progressActive, classes.activeColor)} color="secondary" />
            <PowerSettingsNewIcon className={cx(classes.statusIcon, classes.activeIcon)} />
          </>
        )}

        {!isActive && <BlockIcon className={classes.statusIcon} />}

        <Box className={cx(classes.serverDot, { [classes.serverDotActive]: isActive })} left="6px" />
        <Box className={cx(classes.serverDot, { [classes.serverDotActive]: isActive })} left="12px" />
        <Box className={cx(classes.serverDot, { [classes.serverDotActive]: isActive })} left="18px" />
      </div>
      <div className={cx(classes.serverRow, classes.defaultColor, { [classes.activeColor]: isActive })}>
        <SpeedIcon className={cx(classes.specIcon, classes.defaultColor, { [classes.activeColor]: isActive, [classes.activeIcon]: isActive })} />
        <div className={cx(classes.specDetail, classes.defaultColor, { [classes.activeColor]: isActive })}>{roundDecimal(cpuAmount, 2) + " cpu"}</div>
      </div>

      {gpuAmount > 0 && (
        <div className={cx(classes.serverRow, classes.defaultColor, { [classes.activeColor]: isActive })}>
          <DeveloperBoardIcon className={cx(classes.specIcon, classes.defaultColor, { [classes.activeColor]: isActive, [classes.activeIcon]: isActive })} />
          <div className={cx(classes.specDetail, classes.defaultColor, { [classes.activeColor]: isActive })}>{gpuAmount + " gpu"}</div>
        </div>
      )}

      <div className={cx(classes.serverRow, classes.defaultColor, { [classes.activeColor]: isActive })}>
        <MemoryIcon className={cx(classes.specIcon, classes.defaultColor, { [classes.activeColor]: isActive, [classes.activeIcon]: isActive })} />
        <div className={cx(classes.specDetail, classes.defaultColor, { [classes.activeColor]: isActive })}>{`${roundDecimal(memory.value, 2)} ${
          memory.unit
        }`}</div>
      </div>

      <div className={cx(classes.serverRow, classes.defaultColor, { [classes.activeColor]: isActive })}>
        <StorageIcon className={cx(classes.specIcon, classes.defaultColor, { [classes.activeColor]: isActive, [classes.activeIcon]: isActive })} />
        <div className={cx(classes.specDetail, classes.defaultColor, { [classes.activeColor]: isActive })}>{`${roundDecimal(storage.value, 2)} ${
          storage.unit
        }`}</div>
      </div>
      <Box width="100%" display="flex" borderBottom="4px solid" className={cx(classes.defaultColor, { [classes.activeColor]: isActive })} />
    </Paper>
  );
}
