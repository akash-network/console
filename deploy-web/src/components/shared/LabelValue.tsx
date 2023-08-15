import { Box } from "@mui/material";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(theme => ({
  infoRow: {
    display: "flex",
    marginBottom: "1rem",
    "&:last-child": {
      marginBottom: 0
    },
    [theme.breakpoints.down("sm")]: {
      flexDirection: "column",
      alignItems: "flex-start"
    }
  },
  label: {
    fontWeight: "bold",
    flexShrink: 0,
    wordBreak: "break-all",
    color: theme.palette.grey[600],
    display: "flex",
    alignItems: "center",
    paddingRight: ".5rem"
  },
  value: {
    wordBreak: "break-all",
    overflowWrap: "anywhere",
    flexGrow: 1,
    [theme.breakpoints.down("sm")]: {
      width: "100%"
    }
  }
}));

type LabelValueProps = {
  label: any;
  value?: any;
  labelWidth?: string | number;

  // All other props
  [x: string]: any;
};

export const LabelValue: React.FunctionComponent<LabelValueProps> = ({ label, value, labelWidth = "15rem", ...rest }) => {
  const { classes } = useStyles();

  return (
    <Box className={classes.infoRow} {...rest}>
      <Box className={classes.label} sx={{ width: labelWidth }}>
        {label}
      </Box>
      {!!value && <div className={classes.value}>{value}</div>}
    </Box>
  );
};
