import React from "react";
// import HelpIcon from "@mui/icons-material/Help";
// import TimelineIcon from "@mui/icons-material/Timeline";
// import { makeStyles } from "tss-react/mui";
// import Card from "@mui/material/Card";
// import CardHeader from "@mui/material/CardHeader";
// import { DiffNumber } from "../shared/DiffNumber";
// import { DiffPercentageChip } from "../shared/DiffPercentageChip";
// import CardActions from "@mui/material/CardActions";
// import Button from "@mui/material/Button";
// import Box from "@mui/material/Box";
import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radix-ui/react-tooltip";
import { Button } from "@/components/ui/Button";
// import { cx } from "@emotion/css";
// import { customColors } from "@src/utils/colors";
// import { CustomTooltip } from "../shared/CustomTooltip";
// import { useMediaQuery, useTheme } from "@mui/material";
import { HelpCircle } from "lucide-react";
import { DiffPercentageChip } from "@/components/DiffPercentageChip";
import { DiffNumber } from "@/components/DiffNumber";
import { LineChart } from "lucide-react";

interface IStatsCardProps {
  number: React.ReactNode;
  text: string;
  diffNumber?: number;
  diffNumberUnit?: string;
  diffPercent?: number;
  tooltip?: string | React.ReactNode;
  graphPath?: string;
  actionButton?: string | React.ReactNode;
}

// const useStyles = makeStyles()(theme => ({
//   root: {
//     position: "relative",
//     height: "100%",
//     flexGrow: 1,
//     borderRadius: ".5rem",
//     display: "flex",
//     flexDirection: "column",
//     alignItems: "center"
//   },
//   rootSmall: {
//     height: "auto"
//   },
//   title: {
//     fontSize: "1rem",
//     fontWeight: 300,
//     textTransform: "uppercase",
//     margin: 0,
//     color: theme.palette.mode === "dark" ? theme.palette.grey[600] : theme.palette.grey[700],
//     paddingBottom: "3px",
//     display: "flex",
//     alignItems: "center"
//   },
//   number: {
//     fontSize: "1.5rem",
//     lineHeight: "1.5rem",
//     fontWeight: "500",
//     margin: 0,
//     display: "inline-flex"
//   },
//   cardHeader: { width: "100%", padding: ".75rem 1rem .5rem" },
//   cardContent: {
//     padding: "0 1rem .75rem",
//     flexGrow: 1,
//     alignSelf: "flex-start",
//     display: "flex",
//     flexDirection: "column"
//   },

//   extraText: {
//     fontWeight: "bold",
//     fontSize: 12,
//     display: "block"
//   },
//   tooltip: {
//     fontSize: "1.1rem",
//     margin: "8px",
//     position: "absolute",
//     top: ".25rem",
//     right: 0
//   },
//   subHeader: {
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     fontSize: ".7rem"
//   },
//   actionIcon: {
//     fontSize: "1rem",
//     color: customColors.link
//   },
//   actionButtonLabel: {
//     fontSize: ".7rem",
//     fontStyle: "italic",
//     color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[700]
//   }
// }));

export const StatsCard: React.FunctionComponent<IStatsCardProps> = ({
  number,
  text,
  tooltip,
  actionButton,
  graphPath,
  diffNumber,
  diffPercent,
  diffNumberUnit
}) => {
  // const theme = useTheme();
  // const { classes } = useStyles();
  // const smallScreen = useMediaQuery(theme.breakpoints.down("sm"));

  //   root: {
  //     position: "relative",
  //     height: "100%",
  //     flexGrow: 1,
  //     borderRadius: ".5rem",
  //     display: "flex",
  //     flexDirection: "column",
  //     alignItems: "center"
  //   },
  return (
    <Card
    // className={cx(classes.root, { [classes.rootSmall]: smallScreen })} elevation={2}
    >
      {/* {tooltip && (
        <CustomTooltip arrow title={tooltip}>
          <HelpIcon className={classes.tooltip} />
        </CustomTooltip>
      )} */}

      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost">
              <HelpCircle />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      )}

      <CardHeader
      // classes={{ title: classes.title, root: classes.cardHeader, subheader: classes.subHeader }} title={<>{text}</>}
      >
        <CardTitle>{text}</CardTitle>
      </CardHeader>
      <CardContent
      // className={classes.cardContent}
      >
        {/* // fontSize: "1.5rem", // lineHeight: "1.5rem", // fontWeight: "500", // margin: 0, // display: "inline-flex" */}
        <div
          className="m-0 inline-flex text-3xl font-semibold"
          // className={classes.number}
        >
          {number}
        </div>
        {(!!diffNumber || !!diffPercent) && (
          <div
            className="mt-2 inline-flex align-middle"
            // sx={{ display: "inline-flex", alignItems: "center", marginTop: ".5rem" }}
          >
            {!!diffNumber && (
              <div
                className="text-md font-light"
                // sx={{ fontSize: ".75rem", fontWeight: 300, color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[700] }}
              >
                <DiffNumber value={diffNumber} unit={diffNumberUnit} />
              </div>
            )}

            {!!diffPercent && <DiffPercentageChip value={diffPercent} />}
          </div>
        )}
      </CardContent>

      {graphPath && (
        <CardFooter
        // sx={{ alignSelf: "flex-start", padding: 0, paddingBottom: ".5rem", paddingLeft: "1rem" }}
        >
          <Button
            // component={Link}
            // href={graphPath}
            aria-label="graph"
            // size="small" classes={{ text: classes.actionButtonLabel }}
          >
            <Link href={graphPath}>
              <span className="mr-2">Graph</span>
              <LineChart
              // className={classes.actionIcon}
              />
            </Link>
          </Button>

          {actionButton}
        </CardFooter>
      )}
    </Card>
  );
};
