import { cx } from "@emotion/css";
import { MenuItem, Typography } from "@mui/material";
import React from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(theme => ({
  menuItem: {
    display: "flex",
    alignItems: "center"
  },
  menuItemText: {
    marginLeft: ".5rem"
  }
}));

type Props = {
  icon: string | React.ReactNode;
  onClick: () => any;
  text: string | React.ReactNode;
  className?: string;
  disabled?: boolean;
};

export const CustomMenuItem = React.forwardRef<HTMLLIElement, Props>(({ onClick, icon, text, disabled, className = "" }, ref) => {
  const { classes } = useStyles();

  return (
    <MenuItem onClick={onClick} className={cx(classes.menuItem, className)} ref={ref} disabled={disabled}>
      {icon}
      <Typography variant="body1" className={classes.menuItemText}>
        {text}
      </Typography>
    </MenuItem>
  );
});
