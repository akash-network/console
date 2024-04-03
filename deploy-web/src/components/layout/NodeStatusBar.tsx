"use client";
import { useSettings } from "../../context/SettingsProvider";
import { NodeStatus } from "../shared/NodeStatus";
import { useRouter } from "next/navigation";
import { UrlService } from "@src/utils/urlUtils";
import { getSplitText } from "@src/hooks/useShortText";
import { LinearLoadingSkeleton } from "../shared/LinearLoadingSkeleton";
import { useSelectedNetwork } from "@src/hooks/useSelectedNetwork";
import { Button } from "../ui/button";

export const NodeStatusBar = () => {
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
          <Button size="sm" className="w-full" variant="outline" onClick={() => router.push(UrlService.settings())}>
            <div className="ml-2">{shownNode?.id?.length > 15 ? getSplitText(shownNode?.id, 0, 15) : shownNode?.id}</div>

            <div className="ml-2 text-xs">
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
