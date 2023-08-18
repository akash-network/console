import React from "react";
import HelpIcon from "@mui/icons-material/Help";
import TimelineIcon from "@mui/icons-material/Timeline";
import { makeStyles } from "tss-react/mui";
import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import { DiffNumber } from "../shared/DiffNumber";
import { DiffPercentageChip } from "../shared/DiffPercentageChip";
import CardActions from "@mui/material/CardActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Link from "next/link";
import { cx } from "@emotion/css";
import { customColors } from "@src/utils/colors";
import { CustomTooltip } from "../shared/CustomTooltip";
import { useMediaQuery, useTheme } from "@mui/material";

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

const useStyles = makeStyles()(theme => ({
  root: {
    position: "relative",
    height: "100%",
    flexGrow: 1,
    borderRadius: ".5rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  rootSmall: {
    height: "auto"
  },
  title: {
    fontSize: "1rem",
    fontWeight: 300,
    textTransform: "uppercase",
    margin: 0,
    color: theme.palette.mode === "dark" ? theme.palette.grey[600] : theme.palette.grey[700],
    paddingBottom: "3px",
    display: "flex",
    alignItems: "center"
  },
  number: {
    fontSize: "1.5rem",
    lineHeight: "1.5rem",
    fontWeight: "500",
    margin: 0,
    display: "inline-flex"
  },
  cardHeader: { width: "100%", padding: ".75rem 1rem .5rem" },
  cardContent: {
    padding: "0 1rem .75rem",
    flexGrow: 1,
    alignSelf: "flex-start",
    display: "flex",
    flexDirection: "column"
  },

  extraText: {
    fontWeight: "bold",
    fontSize: 12,
    display: "block"
  },
  tooltip: {
    fontSize: "1.1rem",
    margin: "8px",
    position: "absolute",
    top: ".25rem",
    right: 0
  },
  subHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: ".7rem"
  },
  actionIcon: {
    fontSize: "1rem",
    color: customColors.link
  },
  actionButtonLabel: {
    fontSize: ".7rem",
    fontStyle: "italic",
    color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[700]
  }
}));

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
  const theme = useTheme();
  const { classes } = useStyles();
  const smallScreen = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Card className={cx(classes.root, { [classes.rootSmall]: smallScreen })} elevation={2}>
      {tooltip && (
        <CustomTooltip arrow title={tooltip}>
          <HelpIcon className={classes.tooltip} />
        </CustomTooltip>
      )}

      <CardHeader classes={{ title: classes.title, root: classes.cardHeader, subheader: classes.subHeader }} title={<>{text}</>} />
      <div className={classes.cardContent}>
        <div className={classes.number}>{number}</div>

        {(!!diffNumber || !!diffPercent) && (
          <Box sx={{ display: "inline-flex", alignItems: "center", marginTop: ".5rem" }}>
            {!!diffNumber && (
              <Box sx={{ fontSize: ".75rem", fontWeight: 300, color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[700] }}>
                <DiffNumber value={diffNumber} unit={diffNumberUnit} />
              </Box>
            )}

            {!!diffPercent && <DiffPercentageChip value={diffPercent} />}
          </Box>
        )}
      </div>

      {graphPath && (
        <CardActions sx={{ alignSelf: "flex-start", padding: 0, paddingBottom: ".5rem", paddingLeft: "1rem" }}>
          <Button component={Link} href={graphPath} aria-label="graph" size="small" classes={{ text: classes.actionButtonLabel }}>
            <Box component="span" marginRight=".5rem">
              Graph
            </Box>
            <TimelineIcon className={classes.actionIcon} />
          </Button>

          {actionButton}
        </CardActions>
      )}
    </Card>
  );
};
