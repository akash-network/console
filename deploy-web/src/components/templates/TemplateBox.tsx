import React from "react";
import { Avatar, Card, CardContent, CardHeader, Typography } from "@mui/material";
import { makeStyles } from "tss-react/mui";
import { ApiTemplate } from "@src/types";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import ImageIcon from "@mui/icons-material/Image";
import { getShortText } from "@src/utils/stringUtils";

const useStyles = makeStyles()(theme => ({
  root: {
    cursor: "pointer",
    minHeight: "184px",
    "&:hover": {
      backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100]
    }
  }
}));

type Props = {
  template: ApiTemplate;
  linkHref?: string;
  children?: React.ReactNode;
};

export const TemplateBox: React.FunctionComponent<Props> = ({ template, linkHref }) => {
  const { classes } = useStyles();

  return (
    <Link href={linkHref ? linkHref : UrlService.templateDetails(template.id)}>
      <Card className={classes.root}>
        <CardHeader
          avatar={
            template.logoUrl ? (
              <Avatar src={template.logoUrl} variant="circular" />
            ) : (
              <Avatar variant="circular">
                <ImageIcon />
              </Avatar>
            )
          }
          title={template.name}
        ></CardHeader>
        <CardContent sx={{ paddingTop: "0", paddingBottom: "1rem !important" }}>
          <Typography variant="caption" color="textSecondary">
            {getShortText(template.summary, 128)}
          </Typography>
        </CardContent>
      </Card>
    </Link>
  );
};
