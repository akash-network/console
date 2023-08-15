import { Avatar, Card, CardContent, CardHeader, Collapse, IconButton, List, ListItem, ListItemAvatar, ListItemText, useTheme } from "@mui/material";
import { ReactNode, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ImageIcon from "@mui/icons-material/Image";
import WorkIcon from "@mui/icons-material/Work";
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import { makeStyles } from "tss-react/mui";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import CategoryIcon from "@mui/icons-material/Category";
import SchoolIcon from "@mui/icons-material/School";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";

const useStyles = makeStyles()(theme => ({
  listItemAvatar: {
    width: "4rem",
    height: "4rem"
  }
}));

type Props = {
  children?: ReactNode;
};

export const WelcomePanel: React.FC<Props> = () => {
  const [expanded, setExpanded] = useState(true);
  const theme = useTheme();
  const { classes } = useStyles();

  return (
    <Card elevation={1}>
      <CardHeader
        title="Welcome to Cloudmos!"
        titleTypographyProps={{ variant: "h3", sx: { fontSize: "1.25rem", fontWeight: "bold" } }}
        sx={{ borderBottom: expanded ? `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200]}` : "" }}
        action={
          <IconButton onClick={() => setExpanded(prev => !prev)}>
            <ExpandMoreIcon />
          </IconButton>
        }
      />

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <CardContent sx={{ padding: "0 !important" }}>
          <List>
            <ListItem>
              <ListItemAvatar>
                <RocketLaunchIcon fontSize="large" />
              </ListItemAvatar>
              <ListItemText
                primary={<Link href={UrlService.getStarted()}>Getting started with Cloudmos</Link>}
                secondary="Learn how to deploy your first docker container on Akash in a few click using Cloudmos."
              />
            </ListItem>
            <ListItem>
              <ListItemAvatar>
                <CategoryIcon fontSize="large" />
              </ListItemAvatar>
              <ListItemText
                primary={<Link href={UrlService.templates()}>Explore the marketplace</Link>}
                secondary="Browse through the marketplace of pre-made solutions with categories like blogs, blockchain nodes and more!"
              />
            </ListItem>
            <ListItem>
              <ListItemAvatar>
                <SchoolIcon fontSize="large" />
              </ListItemAvatar>
              <ListItemText
                primary={
                  <a target="_blank" rel="noopener noreferrer" href="https://docs.akash.network/">
                    Learn more about Akash
                  </a>
                }
                secondary="Want to know about the advantages of using a decentralized cloud compute marketplace?"
              />
            </ListItem>
          </List>
        </CardContent>
      </Collapse>
    </Card>
  );
};
