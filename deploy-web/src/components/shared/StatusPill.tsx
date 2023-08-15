import { cx } from "@emotion/css";
import { CSSProperties } from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(theme => ({
  root: {
    borderRadius: "1rem"
  },
  small: {
    marginLeft: ".5rem",
    width: ".5rem",
    height: ".5rem"
  },
  medium: {
    marginLeft: "1rem",
    width: ".9rem",
    height: ".9rem"
  },
  statusActive: {
    backgroundColor: theme.palette.success.dark
  },
  statusClosed: {
    backgroundColor: theme.palette.error.main
  }
}));

type Props = {
  state: "active" | "closed" | string;
  style?: CSSProperties;
  size?: "small" | "medium";
};

export const StatusPill: React.FunctionComponent<Props> = ({ state, style, size = "medium" }) => {
  const { classes } = useStyles();

  return (
    <div
      style={style}
      className={cx(classes.root, {
        [classes.small]: size === "small",
        [classes.medium]: size === "medium",
        [classes.statusActive]: state === "active",
        [classes.statusClosed]: state === "closed"
      })}
    />
  );
};
