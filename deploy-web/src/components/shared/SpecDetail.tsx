"use client";
import { bytesToShrink } from "@src/utils/unitUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { useMediaQuery } from "usehooks-ts";
import { breakpoints } from "@src/utils/responsiveUtils";
import { cn } from "@src/utils/styleUtils";
import { Badge } from "../ui/badge";

// const useStyles = makeStyles()(theme => ({
//   defaultColor: {
//     borderColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100]
//   },
//   chipRoot: {
//     padding: "2px 0",
//     height: "auto",
//     backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[700] : theme.palette.grey[100],
//     borderRadius: "2rem"
//   },
//   chipLabel: {
//     display: "flex",
//     alignItems: "center",
//     padding: "2px 0",
//     color: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.primary.main
//   },
//   specIconSmall: {
//     fontSize: ".8rem"
//   },
//   specIconMedium: {
//     fontSize: "1.5rem"
//   },
//   specIconLarge: {
//     fontSize: "2rem"
//   },
//   specDetail: {
//     marginLeft: ".5rem"
//   },
//   specDetailSmall: {
//     fontSize: ".8rem",
//     lineHeight: ".8rem"
//   },
//   specDetailMedium: {
//     fontSize: ".9rem",
//     lineHeight: ".8rem"
//   },
//   specDetailLarge: {
//     fontSize: "1rem",
//     lineHeight: ".8rem"
//   },
//   gutterSmall: {
//     marginLeft: ".5rem"
//   },
//   gutterMedium: {
//     marginLeft: ".75rem"
//   },
//   gutterLarge: {
//     marginLeft: "1rem"
//   }
// }));

export function SpecDetail({
  cpuAmount,
  memoryAmount,
  storageAmount,
  gpuAmount = 0,
  gpuModels,
  color = "default",
  size = "large",
  gutterSize = "large"
}: React.PropsWithChildren<{
  cpuAmount: number;
  memoryAmount: number;
  storageAmount: number;
  gpuAmount: number;
  gpuModels?: { vendor: string; model: string }[];
  color: string;
  size: "small" | "medium" | "large";
  gutterSize: "small" | "medium" | "large";
}>) {
  const memory = bytesToShrink(memoryAmount);
  const storage = bytesToShrink(storageAmount);
  // TODO
  const smallScreen = useMediaQuery(breakpoints.md.mediaQuery);

  return (
    <div
      className={cn("flex", { ["items-start"]: smallScreen, ["items-center"]: !smallScreen }, { ["flex-col"]: smallScreen, ["flex-row"]: !smallScreen })}
      // sx={{
      //   display: "flex",
      //   alignItems: { xs: "start", sm: "start", md: "center" },
      //   flexDirection: { xs: "column", sm: "column", md: "row" }
      // }}
    >
      <Badge
      // variant="outlined"
      // TODO Type
      // color={color as any}
      // classes={{ root: classes.chipRoot }}
      // className={cx({ [classes.defaultColor]: color === "default" })}
      >
        <div className={classes.chipLabel}>
          <MdSpeed
            className={cx({
              [classes.specIconSmall]: size === "small",
              [classes.specIconMedium]: size === "medium",
              [classes.specIconLarge]: size === "large"
            })}
          />
          <div
            className={cx(classes.specDetail, {
              [classes.specDetailSmall]: size === "small",
              [classes.specDetailMedium]: size === "medium",
              [classes.specDetailLarge]: size === "large"
            })}
          >
            {roundDecimal(cpuAmount, 2) + " CPU"}
          </div>
        </div>
      </Badge>

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
              <MdDeveloperBoard
                className={cx({
                  [classes.specIconSmall]: size === "small",
                  [classes.specIconMedium]: size === "medium",
                  [classes.specIconLarge]: size === "large"
                })}
              />
              <div
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
              </div>
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
            <MdMemory
              className={cx({
                [classes.specIconSmall]: size === "small",
                [classes.specIconMedium]: size === "medium",
                [classes.specIconLarge]: size === "large"
              })}
            />
            <div
              className={cx(classes.specDetail, {
                [classes.specDetailSmall]: size === "small",
                [classes.specDetailMedium]: size === "medium",
                [classes.specDetailLarge]: size === "large"
              })}
            >
              {`${roundDecimal(memory.value, 2)} ${memory.unit}`}
            </div>
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
            <MdStorage
              className={cx({
                [classes.specIconSmall]: size === "small",
                [classes.specIconMedium]: size === "medium",
                [classes.specIconLarge]: size === "large"
              })}
            />
            <div
              className={cx(classes.specDetail, {
                [classes.specDetailSmall]: size === "small",
                [classes.specDetailMedium]: size === "medium",
                [classes.specDetailLarge]: size === "large"
              })}
            >
              {`${roundDecimal(storage.value, 2)} ${storage.unit}`}
            </div>
          </div>
        }
      />
    </div>
  );
}
