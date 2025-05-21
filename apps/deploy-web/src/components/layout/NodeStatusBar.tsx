"use client";
import { Button, Separator } from "@akashnetwork/ui/components";
import { useRouter } from "next/navigation";

import { useSettings } from "@src/context/SettingsProvider";
import { getSplitText } from "@src/hooks/useShortText";
import networkStore from "@src/store/networkStore";
import { UrlService } from "@src/utils/urlUtils";
import { LinearLoadingSkeleton } from "../shared/LinearLoadingSkeleton";
import { NodeStatus } from "../shared/NodeStatus";

export const NodeStatusBar = () => {
  const { settings, isRefreshingNodeStatus } = useSettings();
  const { selectedNode, isCustomNode, customNode } = settings;
  const router = useRouter();
  const shownNode = isCustomNode ? customNode : selectedNode;
  const selectedNetwork = networkStore.useSelectedNetwork();

  return (
    <div>
      <div className="flex items-center px-2 py-2">
        <span className="text-sm font-bold">{selectedNetwork.title}</span>
      </div>

      <LinearLoadingSkeleton isLoading={isRefreshingNodeStatus} />
      <div className="flex items-center">
        {shownNode && (
          <Button size="sm" className="flex w-full items-center justify-between text-xs" variant="secondary" onClick={() => router.push(UrlService.settings())}>
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

      <Separator className="my-2" />
    </div>
  );
};
