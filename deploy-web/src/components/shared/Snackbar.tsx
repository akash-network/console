import { cx } from "@emotion/css";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { makeStyles } from "tss-react/mui";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { ReactNode } from "react";

type IconVariant = "info" | "warning" | "error" | "success";
type Props = {
  title: string;
  subTitle?: string | ReactNode;
  iconVariant?: IconVariant;
  showLoading?: boolean;
  children?: ReactNode;
};

const useStyles = makeStyles()(theme => ({
  snackBarTitle: {
    fontSize: "1.1rem",
    lineHeight: "1rem",
    fontWeight: "bold",
    flexGrow: 1
  },
  marginBottom: {
    marginBottom: ".5rem"
  },
  snackBarSubTitle: {
    fontSize: ".9rem",
    wordBreak: "break-word"
  },
  loading: {
    color: theme.palette.primary.contrastText
  }
}));

export const Snackbar: React.FunctionComponent<Props> = ({ title, subTitle, iconVariant, showLoading = false }) => {
  const { classes } = useStyles();
  const icon = getIcon(iconVariant);

  return (
    <div>
      <Box
        display="flex"
        alignItems="center"
        className={cx({
          [classes.marginBottom]: !!subTitle
        })}
      >
        {!!icon && (
          <Box display="flex" alignItems="center" paddingRight=".5rem">
            {icon}
          </Box>
        )}

        {showLoading && (
          <Box display="flex" alignItems="center" paddingRight=".5rem">
            <CircularProgress size="1rem" className={classes.loading} />
          </Box>
        )}
        <Typography variant="h5" className={classes.snackBarTitle}>
          {title}
        </Typography>
      </Box>

      {subTitle && (
        <Typography variant="body1" className={classes.snackBarSubTitle}>
          {subTitle}
        </Typography>
      )}
    </div>
  );
};

const getIcon = (variant: IconVariant) => {
  switch (variant) {
    case "info":
      return <InfoIcon fontSize="small" />;
    case "warning":
      return <WarningIcon fontSize="small" />;
    case "error":
      return <ErrorIcon fontSize="small" />;
    case "success":
      return <CheckCircleIcon fontSize="small" />;

    default:
      return null;
  }
};
