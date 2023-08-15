import { Box, LinearProgress } from "@mui/material";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(theme => ({
  loadingSkeleton: {
    height: "4px",
    width: "100%"
  }
}));

export function LinearLoadingSkeleton({ isLoading }) {
  const { classes } = useStyles();

  return <>{isLoading ? <LinearProgress color="secondary" /> : <Box className={classes.loadingSkeleton} />}</>;
}
