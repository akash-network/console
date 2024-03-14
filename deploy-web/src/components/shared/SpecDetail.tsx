import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import SpeedIcon from "@mui/icons-material/Speed";
import { makeStyles } from "tss-react/mui";
import { Box, Chip, useMediaQuery, useTheme } from "@mui/material";
import { cx } from "@emotion/css";
import { bytesToShrink } from "@src/utils/unitUtils";
import { roundDecimal } from "@src/utils/mathHelpers";

const useStyles = makeStyles()(theme => ({
  defaultColor: {
    borderColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100]
  },
  chipRoot: {
    padding: "2px 0",
    height: "auto",
    backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[700] : theme.palette.grey[100],
    borderRadius: "2rem"
  },
  chipLabel: {
    display: "flex",
    alignItems: "center",
    padding: "2px 0",
    color: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.primary.main
  },
  specIconSmall: {
    fontSize: ".8rem"
  },
  specIconMedium: {
    fontSize: "1.5rem"
  },
  specIconLarge: {
    fontSize: "2rem"
  },
  specDetail: {
    marginLeft: ".5rem"
  },
  specDetailSmall: {
    fontSize: ".8rem",
    lineHeight: ".8rem"
  },
  specDetailMedium: {
    fontSize: ".9rem",
    lineHeight: ".8rem"
  },
  specDetailLarge: {
    fontSize: "1rem",
    lineHeight: ".8rem"
  },
  gutterSmall: {
    marginLeft: ".5rem"
  },
  gutterMedium: {
    marginLeft: ".75rem"
  },
  gutterLarge: {
    marginLeft: "1rem"
  }
}));

export function SpecDetail({
  cpuAmount,
  memoryAmount,
  storageAmount,
  gpuAmount = 0,
  gpuModels,
  color = "default",
  size = "large",
  gutterSize = "large"
}: {
  cpuAmount: number;
  memoryAmount: number;
  storageAmount: number;
  gpuAmount?: number;
  gpuModels?: { vendor: string; model: string }[];
  color?: React.ComponentProps<typeof Chip>["color"];
  size?: "small" | "medium" | "large";
  gutterSize?: "small" | "medium" | "large";
}) {
  const { classes } = useStyles();
  const memory = bytesToShrink(memoryAmount);
  const storage = bytesToShrink(storageAmount);
  const theme = useTheme();
  const smallScreen = useMediaQuery(theme.breakpoints.down("md"));

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: { xs: "start", sm: "start", md: "center" },
        flexDirection: { xs: "column", sm: "column", md: "row" }
      }}
    >
      <Chip
        variant="outlined"
        color={color}
        classes={{ root: classes.chipRoot }}
        className={cx({ [classes.defaultColor]: color === "default" })}
        label={
          <div className={classes.chipLabel}>
            <SpeedIcon
              className={cx({
                [classes.specIconSmall]: size === "small",
                [classes.specIconMedium]: size === "medium",
                [classes.specIconLarge]: size === "large"
              })}
            />
            <Box
              className={cx(classes.specDetail, {
                [classes.specDetailSmall]: size === "small",
                [classes.specDetailMedium]: size === "medium",
                [classes.specDetailLarge]: size === "large"
              })}
            >
              {roundDecimal(cpuAmount, 2) + " CPU"}
            </Box>
          </div>
        }
      />

      {gpuAmount > 0 && (
        <Chip
          variant="outlined"
          // TODO Type
          color={color as any}
          classes={{ root: classes.chipRoot }}
          className={cx({
            [classes.defaultColor]: color === "default",
            [classes.gutterSmall]: !smallScreen && gutterSize === "small",
            [classes.gutterMedium]: !smallScreen && gutterSize === "medium",
            [classes.gutterLarge]: !smallScreen && gutterSize === "large"
          })}
          label={
            <div className={classes.chipLabel}>
              <SpeedIcon
                className={cx({
                  [classes.specIconSmall]: size === "small",
                  [classes.specIconMedium]: size === "medium",
                  [classes.specIconLarge]: size === "large"
                })}
              />
              <Box
                style={{ display: "flex", alignItems: "center" }}
                className={cx(classes.specDetail, {
                  [classes.specDetailSmall]: size === "small",
                  [classes.specDetailMedium]: size === "medium",
                  [classes.specDetailLarge]: size === "large"
                })}
              >
                {gpuAmount + " GPU"}

                {gpuModels?.length > 0 && (
                  <div style={{ display: "inline", marginLeft: "5px" }}>
                    {gpuModels.map((gpu, i) => (
                      <Chip
                        key={`${gpu.vendor}-${gpu.model}`}
                        label={`${gpu.vendor}-${gpu.model}`}
                        sx={{ marginRight: i < gpuModels.length ? ".2rem" : 0 }}
                        color="default"
                        size="small"
                      />
                    ))}
                  </div>
                )}
              </Box>
            </div>
          }
        />
      )}

      <Chip
        variant="outlined"
        // TODO Type
        color={color as any}
        classes={{ root: classes.chipRoot }}
        className={cx({
          [classes.defaultColor]: color === "default",
          [classes.gutterSmall]: !smallScreen && gutterSize === "small",
          [classes.gutterMedium]: !smallScreen && gutterSize === "medium",
          [classes.gutterLarge]: !smallScreen && gutterSize === "large"
        })}
        label={
          <div className={classes.chipLabel}>
            <MemoryIcon
              className={cx({
                [classes.specIconSmall]: size === "small",
                [classes.specIconMedium]: size === "medium",
                [classes.specIconLarge]: size === "large"
              })}
            />
            <Box
              className={cx(classes.specDetail, {
                [classes.specDetailSmall]: size === "small",
                [classes.specDetailMedium]: size === "medium",
                [classes.specDetailLarge]: size === "large"
              })}
            >
              {`${roundDecimal(memory.value, 2)} ${memory.unit}`}
            </Box>
          </div>
        }
      />
      <Chip
        variant="outlined"
        // TODO Type
        color={color as any}
        classes={{ root: classes.chipRoot }}
        className={cx({
          [classes.defaultColor]: color === "default",
          [classes.gutterSmall]: !smallScreen && gutterSize === "small",
          [classes.gutterMedium]: !smallScreen && gutterSize === "medium",
          [classes.gutterLarge]: !smallScreen && gutterSize === "large"
        })}
        label={
          <div className={classes.chipLabel}>
            <StorageIcon
              className={cx({
                [classes.specIconSmall]: size === "small",
                [classes.specIconMedium]: size === "medium",
                [classes.specIconLarge]: size === "large"
              })}
            />
            <Box
              className={cx(classes.specDetail, {
                [classes.specDetailSmall]: size === "small",
                [classes.specDetailMedium]: size === "medium",
                [classes.specDetailLarge]: size === "large"
              })}
            >
              {`${roundDecimal(storage.value, 2)} ${storage.unit}`}
            </Box>
          </div>
        }
      />
    </Box>
  );
}
