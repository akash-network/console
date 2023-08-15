import { useSettings } from "../../context/SettingsProvider";
import { makeStyles } from "tss-react/mui";
import { useSelectedNetwork } from "@src/utils/networks";
import { Box, Typography, useTheme } from "@mui/material";
import { NodeStatus } from "../shared/NodeStatus";
import { LinkTo } from "../shared/LinkTo";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import { getSplitText } from "@src/hooks/useShortText";
import { LinearLoadingSkeleton } from "../shared/LinearLoadingSkeleton";

const useStyles = makeStyles()(theme => ({
  link: {
    "&&": {
      width: "100%",
      backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100],
      textDecoration: "none",
      color: "inherit",
      display: "inline-flex",
      fontSize: ".75rem",
      alignItems: "center",
      justifyContent: "center",
      padding: ".5rem",
      borderRadius: "4px",
      transition: "all .3s ease",
      "&:hover": {
        backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey["800"] : theme.palette.grey["300"]
      }
    }
  }
}));

export const NodeStatusBar = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const { settings, isRefreshingNodeStatus } = useSettings();
  const { selectedNode, isCustomNode, customNode } = settings;
  const router = useRouter();
  const shownNode = isCustomNode ? customNode : selectedNode;
  const selectedNetwork = useSelectedNetwork();

  return (
    <Box sx={{ marginBottom: "1rem" }}>
      <Box sx={{ textAlign: "center" }}>
        <Typography variant="caption" color="textSecondary" sx={{ fontWeight: "bold" }}>
          {selectedNetwork.title}
        </Typography>
      </Box>

      <LinearLoadingSkeleton isLoading={isRefreshingNodeStatus} />
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {shownNode && (
          <LinkTo onClick={() => router.push(UrlService.settings())} className={classes.link}>
            <Box marginLeft=".5rem">{shownNode?.id?.length > 15 ? getSplitText(shownNode?.id, 0, 15) : shownNode?.id}</Box>

            <Box sx={{ marginLeft: ".5rem", fontSize: ".5rem !important" }}>
              <NodeStatus latency={Math.floor(shownNode?.latency)} status={shownNode?.status} variant="dense" />
            </Box>
          </LinkTo>
        )}

        {!shownNode && isCustomNode && (
          <LinkTo onClick={() => router.push(UrlService.settings())} className={classes.link}>
            Custom node...
          </LinkTo>
        )}
      </Box>
    </Box>
  );
};
