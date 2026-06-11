import type { FC } from "react";
import { Button, CustomTooltip } from "@akashnetwork/ui/components";
import { InfoCircle, Plus } from "iconoir-react";

import { EndpointRow } from "../EndpointRow/EndpointRow";
import { useEndpointManager } from "../useEndpointManager/useEndpointManager";

export const DEPENDENCIES = { EndpointRow, useEndpointManager };

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export const IpEndpointsSection: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const manager = d.useEndpointManager();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 font-mono text-xs uppercase text-muted-foreground">
        IP Endpoints
        <CustomTooltip
          className="max-w-[260px] p-3 font-sans text-xs normal-case text-muted-foreground"
          title="IP endpoints provide a dedicated IP for your deployment. Reference an endpoint from a service's port to bind that port to the leased IP."
        >
          <InfoCircle className="h-3.5 w-3.5" />
        </CustomTooltip>
      </div>
      {manager.endpoints.length > 0 && (
        <ul aria-label="IP endpoints" className="space-y-2">
          {manager.endpoints.map((endpoint, index) => (
            <d.EndpointRow key={endpoint.id} endpoint={endpoint} endpointIndex={index} onRemove={() => manager.removeEndpoint(endpoint.id)} />
          ))}
        </ul>
      )}
      <Button
        type="button"
        variant="ghost"
        onClick={manager.addEndpoint}
        className="w-full gap-1.5 rounded-lg border border-zinc-300 py-2 text-foreground dark:border-zinc-700"
      >
        <Plus className="h-4 w-4" />
        Add endpoint
      </Button>
    </div>
  );
};
