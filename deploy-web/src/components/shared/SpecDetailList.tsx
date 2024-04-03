"use client";
import { bytesToShrink } from "@src/utils/unitUtils";
import { roundDecimal } from "@src/utils/mathHelpers";
import { Card, CardContent } from "../ui/card";
import LinearProgress from "@mui/material/LinearProgress/LinearProgress";
import { cn } from "@src/utils/styleUtils";
import { Server, SwitchOn } from "iconoir-react";
import { MdBlock, MdDeveloperBoard, MdMemory, MdSpeed, MdStorage } from "react-icons/md";

// const useStyles = makeStyles()(theme => ({
//   root: {
//     display: "inline-block",
//     alignItems: "center",
//     flexDirection: "column",
//     borderRadius: 0
//   },
//   defaultColor: {
//     color: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[400],
//     borderColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : "rgba(0,0,0,.2)"
//   },
//   activeColor: {
//     color: theme.palette.mode === "dark" ? `${theme.palette.grey[500]} !important` : `${theme.palette.grey[700]} !important`,
//     borderColor: theme.palette.mode === "dark" ? "rgba(0,0,0,.4) !important" : "rgba(0,0,0,.25) !important"
//   },
//   serverRow: {
//     width: "110px",
//     border: "1px solid",
//     borderRightWidth: "2px",
//     borderLeftWidth: "2px",
//     textAlign: "center",
//     display: "flex",
//     alignItems: "center",
//     padding: "2px 4px"
//   },
//   serverTop: {
//     width: "100%",
//     display: "flex",
//     borderBottom: "12px solid",
//     height: "16px",
//     borderTop: "2px solid",
//     borderRight: "1px solid",
//     borderLeft: "1px solid",
//     position: "relative"
//   },
//   serverDot: {
//     position: "absolute",
//     width: "4px",
//     height: "4px",
//     borderRadius: "4px",
//     bottom: "-8px",
//     backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[700] : theme.palette.secondary.contrastText
//   },
//   serverDotActive: {
//     animation: "$glow 1s ease-in-out infinite alternate",
//     backgroundColor: `${theme.palette.secondary.main} !important`
//   },
//   progressActive: {
//     height: "2px",
//     width: "100%",
//     opacity: "0.25"
//   },
//   statusIcon: {
//     position: "absolute",
//     top: "3px",
//     right: "4px",
//     fontSize: ".7rem",
//     opacity: 0.3,
//     color: theme.palette.secondary.contrastText
//   },
//   activeIcon: {
//     opacity: `1 !important`,
//     color: theme.palette.secondary.main
//   },
//   specIcon: {
//     fontSize: "1rem"
//   },
//   specDetail: {
//     marginLeft: ".75rem",
//     flexGrow: 1,
//     textAlign: "left",
//     fontWeight: "bold",

//     fontSize: ".8rem",
//     lineHeight: ".8rem"
//   },
//   "@keyframes glow": {
//     "0%": {
//       boxShadow: `0 0 0px ${theme.palette.secondary.main}, 0 0 2px ${theme.palette.secondary.main}, 0 0 4px ${theme.palette.secondary.main}`
//     },
//     "100%": {
//       boxShadow: `0 0 4px ${theme.palette.secondary.main}, 0 0 6px ${theme.palette.secondary.main}, 0 0 8px ${theme.palette.secondary.main}`
//     }
//   }
// }));

export function SpecDetailList({ cpuAmount, memoryAmount, storageAmount, gpuAmount = 0, isActive }) {
  // const { classes } = useStyles();
  const memory = bytesToShrink(memoryAmount);
  const storage = bytesToShrink(storageAmount);

  const serverDotClasses = "absolute w-[4px] h-[4px] rounded-full bottom-[-8px] bg-gray-700";
  const serverDotActiveClasses = "animate-ping !bg-primary-foreground";
  const activeColorClasses = "text-primary-foreground border-muted-foreground";
  const serverRowClasses = " w-[110px] border-[1px] border-right-[2px] border-left-[2px] text-center flex items-center py-[2px] px-[4px] ";
  const defaultColorClasses = "text-muted-foreground border-muted-foreground/20";
  const activeIconClasses = "opacity-100 !text-primary-foreground";
  const specIconClasses = "text-lg";
  const specDetailClasses = "ml-2 flex-grow text-left font-bold text-sm line-[.8rem]";

  return (
    <Card>
      <CardContent className="p-0 border-r-0 inline-flex flex-col items-center rounded-sm flex-nowrap">
        {/* <div
          className={cn("flex h-[16px] w-full border-x-[1px] border-b-[12px] border-t-[2px]", { ["border-muted-foreground text-muted-foreground"]: isActive })}
        >
          {isActive && (
            <>
              <LinearProgress
                className="h-[2px] w-full opacity-25"
                // className={cx(classes.progressActive, classes.activeColor)}
                color="secondary"
              />
              <SwitchOn
                className="absolute right-[4px] top-[3px] text-xs text-primary-foreground"
                // className={cx(classes.statusIcon, classes.activeIcon)}
              />
            </>
          )}

          {!isActive && (
            <MdBlock
              className="absolute right-[4px] top-[3px] text-xs text-primary-foreground opacity-30"
              // className={classes.statusIcon}
            />
          )}

          <div className={cn("left-[6px]", serverDotClasses, { [serverDotActiveClasses]: isActive })} />
          <div className={cn("left-[12px]", serverDotClasses, { [serverDotActiveClasses]: isActive })} />
          <div className={cn("left-[18px]", serverDotClasses, { [serverDotActiveClasses]: isActive })} />
        </div> */}
        <div className={cn(serverRowClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>
          <MdSpeed className={cn(specIconClasses, defaultColorClasses, { [activeColorClasses]: isActive, [activeIconClasses]: isActive })} />
          <div className={cn(specDetailClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>{roundDecimal(cpuAmount, 2) + " cpu"}</div>
        </div>

        {gpuAmount > 0 && (
          <div className={cn(serverRowClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>
            <MdDeveloperBoard className={cn(specIconClasses, defaultColorClasses, { [activeColorClasses]: isActive, [activeIconClasses]: isActive })} />
            <div className={cn(specDetailClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>{gpuAmount + " gpu"}</div>
          </div>
        )}

        <div className={cn(serverRowClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>
          <MdMemory className={cn(specIconClasses, defaultColorClasses, { [activeColorClasses]: isActive, [activeIconClasses]: isActive })} />
          <div className={cn(specDetailClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>{`${roundDecimal(memory.value, 2)} ${
            memory.unit
          }`}</div>
        </div>

        <div className={cn(serverRowClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>
          <MdStorage className={cn(specIconClasses, defaultColorClasses, { [activeColorClasses]: isActive, [activeIconClasses]: isActive })} />
          <div className={cn(specDetailClasses, defaultColorClasses, { [activeColorClasses]: isActive })}>{`${roundDecimal(storage.value, 2)} ${
            storage.unit
          }`}</div>
        </div>
        {/* <div
          className="flex w-full border-b-4 bg-muted-foreground text-muted-foreground"
          // className={cx(classes.defaultColor, { [classes.activeColor]: isActive })}
        /> */}
      </CardContent>
    </Card>
  );
}
