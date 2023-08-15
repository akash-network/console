import React from "react";
import { Avatar, Card, CardContent, CardHeader, Typography } from "@mui/material";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(theme => ({
  root: {
    cursor: "pointer",
    minHeight: "100px",
    "&:hover": {
      backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100]
    }
  }
}));

type Props = {
  title: string;
  description: string;
  icon?: React.ReactNode;
  imageUrl?: string;
  onClick: () => void;
  children?: React.ReactNode;
};

export const DeployOptionBox: React.FunctionComponent<Props> = ({ title, description, icon, imageUrl, onClick }) => {
  const { classes } = useStyles();

  return (
    <Card className={classes.root} onClick={onClick}>
      <CardHeader avatar={icon ? <Avatar variant="circular">{icon}</Avatar> : <Avatar src={imageUrl} variant="circular" />} title={title}></CardHeader>
      <CardContent sx={{ paddingTop: "0", paddingBottom: "1rem !important" }}>
        <Typography variant="caption" color="textSecondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
};
