import { cx } from "@emotion/css";
import { Box, FormLabel } from "@mui/material";
import { ReactNode } from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(theme => ({
  root: { display: "flex", alignItems: "center" },
  label: {
    fontWeight: "bold",
    color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.primary.main,
    fontSize: ".9rem"
  },
  value: {
    display: "flex",
    alignItems: "center",
    marginLeft: ".5rem",
    fontSize: ".9rem"
  }
}));

type Props = {
  label: string;
  value?: string | ReactNode;
  children?: ReactNode;

  // All other props
  [x: string]: any;
};

export const LabelValueOld: React.FunctionComponent<Props> = ({ label, value, ...rest }) => {
  const { classes } = useStyles();

  return (
    <Box className={cx(classes.root)} {...rest}>
      <FormLabel className={classes.label}>{label}</FormLabel>
      {value && <div className={classes.value}>{value}</div>}
    </Box>
  );
};
