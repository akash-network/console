"use client";
import { useSettings } from "../../context/SettingsProvider";
import { NodeStatus } from "../shared/NodeStatus";
import { useRouter } from "next/navigation";
import { UrlService } from "@src/utils/urlUtils";
import { getSplitText } from "@src/hooks/useShortText";
import { LinearLoadingSkeleton } from "../shared/LinearLoadingSkeleton";
import { useSelectedNetwork } from "@src/hooks/useSelectedNetwork";
import { Button } from "../ui/button";

// const useStyles = makeStyles()(theme => ({
//   link: {
//     "&&": {
//       width: "100%",
//       backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100],
//       textDecoration: "none",
//       color: "inherit",
//       display: "inline-flex",
//       fontSize: ".75rem",
//       alignItems: "center",
//       justifyContent: "center",
//       padding: ".5rem",
//       borderRadius: "4px",
//       transition: "all .3s ease",
//       "&:hover": {
//         backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey["800"] : theme.palette.grey["300"]
//       }
//     }
//   }
// }));

export const NodeStatusBar = () => {
  // const { classes } = useStyles();
  // const theme = useTheme();
  const { settings, isRefreshingNodeStatus } = useSettings();
  const { selectedNode, isCustomNode, customNode } = settings;
  const router = useRouter();
  const shownNode = isCustomNode ? customNode : selectedNode;
  const selectedNetwork = useSelectedNetwork();

  return (
    <div className="mb-4">
      <div className="text-center">
        <span className="text-sm font-bold text-muted-foreground">{selectedNetwork.title}</span>
      </div>

      <LinearLoadingSkeleton isLoading={isRefreshingNodeStatus} />
      <div className="flex items-center justify-center">
        {shownNode && (
          <Button size="sm" className="w-full" variant="secondary" onClick={() => router.push(UrlService.settings())}>
            <div className="ml-2">{shownNode?.id?.length > 15 ? getSplitText(shownNode?.id, 0, 15) : shownNode?.id}</div>

            <div
              className="ml-2 text-xs"
              // sx={{ marginLeft: ".5rem", fontSize: ".5rem !important" }}
            >
              <NodeStatus latency={Math.floor(shownNode?.latency)} status={shownNode?.status} variant="dense" />
            </div>
          </Button>
        )}

        {!shownNode && isCustomNode && (
          <Button size="sm" className="w-full" onClick={() => router.push(UrlService.settings())}>
            Custom node...
          </Button>
        )}
      </div>
    </div>
  );
};
