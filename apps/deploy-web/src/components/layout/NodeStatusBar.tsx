"use client";
import { Button } from "@akashnetwork/ui/components";
import { useRouter } from "next/navigation";

import { getSplitText } from "@src/hooks/useShortText";
import networkStore from "@src/store/networkStore";
import { UrlService } from "@src/utils/urlUtils";
import { useSettings } from "../../context/SettingsProvider";
import { LinearLoadingSkeleton } from "../shared/LinearLoadingSkeleton";
import { NodeStatus } from "../shared/NodeStatus";

export const NodeStatusBar = () => {
  const { settings, isRefreshingNodeStatus } = useSettings();
  const { selectedNode, isCustomNode, customNode } = settings;
  const router = useRouter();
  const shownNode = isCustomNode ? customNode : selectedNode;
  const selectedNetwork = networkStore.useSelectedNetwork();

  return (
    <div className="mb-4">
      <div className="text-center">
        <span className="text-sm font-bold text-primary">{selectedNetwork.title}</span>
      </div>

      <LinearLoadingSkeleton isLoading={isRefreshingNodeStatus} />
      <div className="flex items-center justify-center">
        {shownNode && (
          <Button size="sm" className="w-full text-xs" variant="outline" onClick={() => router.push(UrlService.settings())}>
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
