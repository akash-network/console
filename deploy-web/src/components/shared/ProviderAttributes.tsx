import { Box, Typography } from "@mui/material";
import { useState, useEffect } from "react";
import { LinkTo } from "./LinkTo";
import { makeStyles } from "tss-react/mui";
import { cx } from "@emotion/css";

const useStyles = makeStyles()(theme => ({
  attributesContainer: {
    position: "relative",
    flexBasis: "45%",
    margin: "2px 0",
    backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : "rgba(0,0,0,0.05)",
    borderRadius: "4px",
    padding: ".5rem 1rem",
    maxHeight: "100px",
    overflow: "hidden",
    transition: "max-height .3s ease, box-shadow .6s ease"
  },
  hasShadow: {
    boxShadow: "inset 0 -6px 12px -10px rgb(0 0 0 / 50%)"
  },
  expanded: {
    maxHeight: "1000px"
  },
  attributeRow: {
    display: "flex",
    alignItems: "center",
    lineHeight: "1rem"
  },
  attributeText: {
    lineHeight: "1rem",
    letterSpacing: 0
  },
  viewAllButton: {
    position: "absolute",
    top: ".5rem",
    right: "1rem"
  }
}));

export const ProviderAttributes = ({ provider }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isShowingViewAll, setIsShowingViewAll] = useState(false);
  const { classes } = useStyles();

  useEffect(() => {
    const isShowingViewAll = provider?.attributes?.length > 4;
    setIsShowingViewAll(isShowingViewAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onViewAllClick = event => {
    event.preventDefault();
    event.stopPropagation();
    setIsExpanded(prev => !prev);
  };

  return (
    <div className={cx(classes.attributesContainer, { [classes.expanded]: isExpanded, [classes.hasShadow]: isShowingViewAll && !isExpanded })}>
      {isShowingViewAll && (
        <LinkTo onClick={onViewAllClick} className={classes.viewAllButton}>
          View all
        </LinkTo>
      )}
      {provider?.attributes?.map(a => {
        return (
          <div className={classes.attributeRow} key={a.key}>
            <div>
              <Typography variant="caption" className={classes.attributeText}>
                {a.key}:
              </Typography>
            </div>
            <Box marginLeft="1rem">
              <Typography variant="caption" className={classes.attributeText}>
                {a.value}
              </Typography>
            </Box>
          </div>
        );
      })}
    </div>
  );
};
